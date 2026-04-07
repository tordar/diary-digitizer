export const DEFAULT_PROMPT_TEMPLATE = `You are transcribing a handwritten journal page. The text is primarily in Norwegian, but may include English or other languages.

Analyse the image carefully and return a JSON object with exactly these fields:

{
  "entry_type": "text" | "image" | "mixed" | "special",
  "is_continuation": boolean,
  "title": string | null,
  "date": "YYYY-MM-DD" | null,
  "date_inferred": boolean,
  "transcription": string | null,
  "mood": string[],
  "topics": string[],
  "people": string[],
  "places": string[],
  "themes": string[],
  "confidence_score": number between 0.0 and 1.0,
  "split_entries": []
}

Rules:
- entry_type: "text" = prose writing; "image" = drawing/photo with no readable text; "mixed" = text + drawings; "special" = structured page (table, habit tracker, list, index)
- is_continuation: true if this page clearly continues a previous entry mid-sentence or mid-paragraph, with no date header of its own at the top. false otherwise.
- title: a distinct heading or subject written on the page, clearly separate from the date. Examples: "Hobby fotograf", "Side gig", "Drømmer", "Reisedagbok". Set to null only if there is no heading at all — do not confuse the date line with the title. A title written on the same line as or immediately below the date should still be captured.
- date: if a day and month are written (e.g. "24. Mai"), combine with the year from the folder context hint to produce a full YYYY-MM-DD date and set date_inferred: true. If the full date including year is written, use it directly and set date_inferred: false. null only if no date at all is present.
- date_inferred: true if the year was inferred from context rather than written on the page
- transcription: transcribe every line of text on the page, working top to bottom. Be thorough — do not stop early or summarise. For difficult or unclear words, use the surrounding context (sentence structure, topic, handwriting patterns on the same page) to make your best guess at the intended word. Only use [?] if a word is truly unreadable even with context. Never skip a section because it is dense or hard to read. Preserve original language, spelling, and line breaks. null for pure image entries.
- mood: 1–3 mood tags describing the emotional tone. Prefer terms from this list where they fit: [glad, lettet, takknemlig, spent, optimistisk, stolt, energisk, inspirert, rolig, nostalgisk, trist, ensom, frustrert, sint, engstelig, utmattet, overveldet, nedfor, skuffet, urolig, selvkritisk, reflektert, ambivalent, søkende, usikker, melankolsk, sårbar, lengtende, bekymret, håpefull, nøytral, observerende]. Use a term outside this list only if none capture the tone adequately. Empty array if unclear or not applicable.
- topics: 1–5 short topic tags in Norwegian (e.g. "arbeid", "familie", "helse")
- people: actual named individuals only (full names or first names). Do not include generic descriptions like "en sint mann", pronouns like "jeg"/"han"/"hun", or roles like "en ansatt". Leave empty if no real names are mentioned.
- places: cities, countries, or named locations mentioned
- themes: higher-level recurring themes (e.g. "identitet", "fremtid", "ensomhet") that genuinely apply to this page. Only use a theme if it clearly fits the content — do not force themes that are not relevant. If an existing theme from the provided list fits, reuse it (exact same string). If none fit, invent a new one. Leave empty if no themes apply.
- confidence_score: your confidence in the accuracy of this transcription (0.0 = very uncertain, 1.0 = certain)
- split_entries: if this page contains two or more clearly separate dated entries (e.g. "24. Mai ..." followed by "25. Mai ..."), put the FIRST entry's content in the main fields above, and list each additional entry here as an object with fields: { "date": "YYYY-MM-DD" | null, "date_inferred": boolean, "title": string | null, "transcription": string | null, "mood": string[] }. Leave as [] if the page contains only one entry.

Return only valid JSON. No markdown, no explanation.`

export function buildPrompt(template: string, existingThemes: string[] = []): string {
  const base = template === 'default' ? DEFAULT_PROMPT_TEMPLATE : template
  if (existingThemes.length === 0) return base
  return `${base}\n\nExisting themes to reuse where relevant: ${existingThemes.join(', ')}`
}
