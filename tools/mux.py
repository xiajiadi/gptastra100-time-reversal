
import argparse
from fractions import Fraction
from pathlib import Path
import av
from itertools import chain

parser = argparse.ArgumentParser(description="Join the seven render segments and the continuous AAC track.")
parser.add_argument("--width", type=int, choices=(1920, 3840), required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
BASE = Path(__file__).resolve().parent.parent
PARTS = [BASE / "out" / f"part-{i:02}.mp4" for i in range(7)]
MASTER = args.output.resolve()
TEMP = MASTER.with_suffix(".partial.mp4")
AUDIO = BASE / "out" / "audio.aac"
EXPECTED = [1080, 630, 720, 1110, 1050, 930, 780]

def valid_packets(container, stream):
    yield from (packet for packet in container.demux(stream) if packet.dts is not None)

with av.open(str(PARTS[0])) as template, av.open(str(AUDIO)) as audio_in:
    v0 = template.streams.video[0]
    audio = audio_in.streams.audio[0]
    time_base = v0.time_base
    fps = v0.average_rate
    assert time_base == Fraction(1, 30000) and fps == 30

    with av.open(str(TEMP), "w", options={"movflags": "+faststart"}) as output:
        output.metadata["title"] = "GPTAstra100"
        output.metadata["comment"] = "Fiction. Camera pipeline adapted from naichashu66/opus50-entropy (MIT)."
        v_out = output.add_stream_from_template(v0)
        a_out = output.add_stream_from_template(audio)
        audio_packets = valid_packets(audio_in, audio)
        pending_audio = next(audio_packets, None)
        total_frames = 0
        total_audio = 0
        previous_dts = -1
        for part, expected in zip(PARTS, EXPECTED, strict=True):
            with av.open(str(part)) as source:
                v = source.streams.video[0]
                assert (v.width, v.height, v.frames, v.average_rate, v.time_base) == (args.width, args.width * 9 // 16, expected, fps, time_base)
                assert v.codec_context.extradata == v0.codec_context.extradata, f"Codec parameters changed in {part.name}"
                packets = valid_packets(source,v)
                first = next(packets)
                assert first.is_keyframe and first.pts == first.dts == 0, part
                offset = total_frames * 1000
                count = 0
                for packet in chain((first,), packets):
                    packet.pts += offset
                    packet.dts += offset
                    assert packet.dts > previous_dts, (part, packet.dts, previous_dts)
                    previous_dts = packet.dts
                    while pending_audio is not None and pending_audio.dts * pending_audio.time_base <= packet.dts * packet.time_base:
                        pending_audio.stream = a_out
                        output.mux(pending_audio)
                        total_audio += 1
                        pending_audio = next(audio_packets, None)
                    packet.stream = v_out
                    output.mux(packet)
                    count += 1
                assert count == expected
                total_frames += count
                print(f"Muxed {part.name} ({count} frames), total {total_frames}", flush=True)
        while pending_audio is not None:
            pending_audio.stream = a_out
            output.mux(pending_audio)
            total_audio += 1
            pending_audio = next(audio_packets, None)
        assert total_frames == 6300 and 9830 < total_audio < 9870
TEMP.replace(MASTER)
print(f"Created {MASTER} with {total_frames} frames and {total_audio} AAC packets", flush=True)
