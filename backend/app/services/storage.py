from collections.abc import AsyncIterator

from azure.core.exceptions import AzureError, ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient

from app.core.config import Settings
from app.core.errors import DomainError


class AzureBlobDocumentStorage:
    """Private Azure Blob adapter for document binaries; PostgreSQL stores only blob keys/metadata."""

    def __init__(self, settings: Settings):
        if not settings.azure_storage_connection_string:
            raise DomainError(
                "storage_not_configured",
                "Azure Blob Storage is not configured for document operations",
                status_code=503,
            )
        self._connection_string = settings.azure_storage_connection_string
        self._container_name = settings.azure_blob_container
        self._create_container = settings.azure_blob_create_container

    async def upload(self, storage_key: str, content: bytes, content_type: str, overwrite: bool = False) -> None:
        service: BlobServiceClient | None = None
        try:
            service = BlobServiceClient.from_connection_string(self._connection_string)
            container = service.get_container_client(self._container_name)
            if self._create_container:
                try:
                    await container.create_container()
                except ResourceExistsError:
                    pass
            blob = container.get_blob_client(storage_key)
            await blob.upload_blob(
                content,
                overwrite=overwrite,
                content_settings=ContentSettings(content_type=content_type),
            )
        except (AzureError, ImportError, ValueError) as exc:
            raise DomainError("storage_unavailable", "Azure Blob Storage could not store the document", status_code=503) from exc
        finally:
            if service is not None:
                await service.close()

    async def delete(self, storage_key: str) -> None:
        service: BlobServiceClient | None = None
        try:
            service = BlobServiceClient.from_connection_string(self._connection_string)
            await service.get_container_client(self._container_name).delete_blob(storage_key, delete_snapshots="include")
        except ResourceNotFoundError:
            return
        except (AzureError, ImportError, ValueError) as exc:
            raise DomainError("storage_unavailable", "Azure Blob Storage could not remove the document", status_code=503) from exc
        finally:
            if service is not None:
                await service.close()

    async def download(self, storage_key: str) -> AsyncIterator[bytes]:
        service: BlobServiceClient | None = None
        try:
            service = BlobServiceClient.from_connection_string(self._connection_string)
            blob = service.get_container_client(self._container_name).get_blob_client(storage_key)
            downloader = await blob.download_blob()
        except ResourceNotFoundError as exc:
            if service is not None:
                await service.close()
            raise DomainError("document_content_not_found", "Document content is unavailable", status_code=404) from exc
        except (AzureError, ImportError, ValueError) as exc:
            if service is not None:
                await service.close()
            raise DomainError("storage_unavailable", "Azure Blob Storage could not read the document", status_code=503) from exc

        async def stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in downloader.chunks():
                    yield chunk
            finally:
                await service.close()

        return stream()
