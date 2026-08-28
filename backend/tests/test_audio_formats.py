import unittest

from app.services.audio_formats import (
    audio_extension,
    has_expected_audio_signature,
    normalise_audio_mime_type,
)


class AudioFormatTests(unittest.TestCase):
    def test_normalises_browser_codec_parameter(self) -> None:
        self.assertEqual(normalise_audio_mime_type("Audio/WebM; codecs=opus"), "audio/webm")

    def test_maps_browser_formats_to_real_extensions(self) -> None:
        self.assertEqual(audio_extension("audio/webm;codecs=opus"), "webm")
        self.assertEqual(audio_extension("audio/ogg;codecs=opus"), "ogg")
        self.assertEqual(audio_extension("audio/mp4"), "m4a")

    def test_accepts_supported_container_signatures(self) -> None:
        fixtures = {
            "audio/webm": b"\x1a\x45\xdf\xa3\x9fB\x86\x81",
            "audio/ogg": b"OggS\x00\x02fixture",
            "audio/mp4": b"\x00\x00\x00\x18ftypM4A fixture",
            "audio/wav": b"RIFF\x10\x00\x00\x00WAVEfmt ",
            "audio/mpeg": b"ID3\x04\x00\x00fixture",
        }
        for mime_type, content in fixtures.items():
            with self.subTest(mime_type=mime_type):
                self.assertTrue(has_expected_audio_signature(content, mime_type))

    def test_rejects_relabelled_or_unknown_content(self) -> None:
        self.assertFalse(has_expected_audio_signature(b"\x1a\x45\xdf\xa3webm", "audio/wav"))
        self.assertFalse(has_expected_audio_signature(b"RIFF\x10\x00\x00\x00WAVE", "audio/webm"))
        self.assertFalse(has_expected_audio_signature(b"not audio", "application/octet-stream"))


if __name__ == "__main__":
    unittest.main()
