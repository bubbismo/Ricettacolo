/**
 * "Riconoscitore ricetta": riceve una o più immagini e restituisce titolo, ingredienti e procedimento.
 * È l'unico punto che il resto dell'app conosce: oggi c'è l'OCR locale (ocr.ts); un domani si potrà
 * collegare un modello di visione cambiando solo index.ts.
 */
export interface RecognizedRecipe {
  title?: string
  /** ingredienti in forma breve, adatta al campo "ingredienti principali" */
  ingredients?: string
  /** procedimento */
  steps?: string
  /** tutto il testo letto, da conservare e correggere */
  rawText: string
}

export interface RecognizeOptions {
  /** avanzamento da 0 a 1, con un'etichetta leggibile della fase */
  onProgress?: (fraction: number, label: string) => void
  signal?: AbortSignal
}

export interface RecipeRecognizer {
  readonly name: string
  recognize(images: Blob[], options?: RecognizeOptions): Promise<RecognizedRecipe>
}
