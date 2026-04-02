# Inter-room handshake — formats prior room outputs as context for the next room

# Artifact filename labels per room
_ROOM_LABELS = {
    "A": "PROJECT_MANIFEST.md",
    "B": "BRAINSTORM_LOG.md",
    "C": "TECHNICAL_SPEC_V1.json",
    "D": "FINAL_DELIVERY_REPORT.md",
}


def build_handshake_context(session_id: str, artifacts: dict) -> str:
    """
    Format collected room artifacts into a context string for the next room.

    Parameters
    ----------
    session_id : str
        The current session identifier (reserved for future use, e.g. logging).
    artifacts : dict[str, str]
        Mapping of room_id -> artifact content string.
        Only rooms with non-empty content are included.

    Returns
    -------
    str
        A formatted string ready to be injected as prior context, or an empty
        string if no artifacts have been collected yet.
    """
    MAX_CHARS_PER_ARTIFACT = 2000

    sections = []
    for room_id, content in artifacts.items():
        if not content:
            continue
        label = _ROOM_LABELS.get(room_id, room_id)
        truncated = content[:MAX_CHARS_PER_ARTIFACT]
        if len(content) > MAX_CHARS_PER_ARTIFACT:
            truncated += "\n... [truncated for brevity]"
        sections.append(f"[Room {room_id} — {label}]\n{truncated}")

    if not sections:
        return ""

    body = "\n\n".join(sections)
    return f"=== Prior Room Outputs ===\n\n{body}"
