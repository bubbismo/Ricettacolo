import { ocrRecognizer } from './ocr'
import type { RecipeRecognizer } from './types'

export type { RecognizedRecipe, RecipeRecognizer } from './types'

/** L'unico riconoscitore usato dall'app. Per cambiare tecnologia basta sostituirlo qui. */
export const recognizer: RecipeRecognizer = ocrRecognizer
