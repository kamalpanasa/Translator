import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
import wave
from utils.file_manager import save_uploaded_audio


def plot_waveform(uploaded_audio):
    try:
        temp_path = save_uploaded_audio(uploaded_audio)

        with wave.open(temp_path, "rb") as wf:
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            signal = np.frombuffer(wf.readframes(-1), dtype=np.int16)

        step = max(1, len(signal) // 4000)
        signal_ds = signal[::step]
        time_axis = np.linspace(0, n_frames / framerate, len(signal_ds))


        fft_vals = np.abs(np.fft.rfft(signal))
        fft_freqs = np.fft.rfftfreq(len(signal), d=1 / framerate)

        freq_mask = fft_freqs <= 8000
        fft_vals = fft_vals[freq_mask]
        fft_freqs = fft_freqs[freq_mask]

        fig = make_subplots(
            rows=2, cols=1,
            subplot_titles=("Waveform", "Frequency Spectrum"),
            vertical_spacing=0.22,
            row_heights=[0.5, 0.5]
        )

        # Waveform
        fig.add_trace(
            go.Scatter(
                x=time_axis,
                y=signal_ds,
                mode="lines",
                line=dict(color="#22c55e", width=1),
                name="Waveform"
            ),
            row=1, col=1
        )

        # Spectrum
        fig.add_trace(
            go.Scatter(
                x=fft_freqs,
                y=fft_vals,
                mode="lines",
                fill="tozeroy",
                line=dict(color="#38bdf8", width=1),
                fillcolor="rgba(56,189,248,0.2)",
                name="Spectrum"
            ),
            row=2, col=1
        )

        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            height=580,
            showlegend=False,
            margin=dict(l=60, r=20, t=50, b=50)
        )

        for ann in fig.layout.annotations:
            ann.font.size = 13
            ann.font.color = "#94a3b8"

        fig.update_xaxes(title_text="Time (s)", row=1, col=1,
                         gridcolor="#1e293b", title_font=dict(size=11))
        fig.update_yaxes(title_text="Amplitude", row=1, col=1,
                         gridcolor="#1e293b", title_font=dict(size=11))
        fig.update_xaxes(title_text="Frequency (Hz)", row=2, col=1,
                         gridcolor="#1e293b", title_font=dict(size=11))
        fig.update_yaxes(title_text="Magnitude", row=2, col=1,
                         gridcolor="#1e293b", title_font=dict(size=11))

        return fig

    except Exception as e:
        fig = go.Figure()
        fig.update_layout(
            template="plotly_dark",
            title="Could not render waveform",
            paper_bgcolor="rgba(0,0,0,0)"
        )
        return fig
