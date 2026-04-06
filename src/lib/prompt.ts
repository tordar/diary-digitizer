export const DEFAULT_PROMPT_TEMPLATE = `You are transcribing a handwritten journal page. The text is primarily in Norwegian, but may include English or other languages.

Analyse the image carefully and return a JSON object with exactly these fields:

{
  "entry_type": "text" | "image" | "mixed" | "special",
  "title": string | null,
  "date": "YYYY-MM-DD" | null,
  "date_inferred": boolean,
  "transcription": string | null,
  "mood": "glad" | "nøytral" | "lav" | "blandet" | null,
  "topics": string[],
  "people": string[],
  "places": string[],
  "themes": string[],
  "confidence_score": number between 0.0 and 1.0
}

Rules:
- entry_type: "text" = prose writing; "image" = drawing/photo with no readable text; "mixed" = text + drawings; "special" = structured page (table, habit tracker, list, index)
- title: extract from the page heading if present, otherwise null
- date: exact date if written on the page; null if absent
- date_inferred: true if you are estimating the date from context, not reading it directly
- transcription: full verbatim text of the page. Preserve original language and spelling. null for pure image entries.
- mood: overall emotional tone of the entry. null if unclear or not applicable.
- topics: 1–5 short topic tags in Norwegian (e.g. "arbeid", "familie", "helse")
- people: full names or first names of people mentioned
- places: cities, countries, or named locations mentioned
- themes: higher-level recurring themes (e.g. "identitet", "fremtid", "ensomhet")
- confidence_score: your confidence in the accuracy of this transcription (0.0 = very uncertain, 1.0 = certain)

Return only valid JSON. No markdown, no explanation.`

export function buildPrompt(template: string): string {
  return template === 'default' ? DEFAULT_PROMPT_TEMPLATE : template
}
