import {
    SourceInfo,
    SourceIntents
} from '@paperback/types'

// Importe tes extensions ici
import { FairyScansInfo, FairyScans } from './FairyScans/FairyScans'
import { KaganeInfo, Kagane } from './Kagane/Kagane' // <--- AJOUTE CETTE LIGNE

// Ajoute KaganeInfo et Kagane dans les listes ci-dessous
export const Sources = [
    makeSource({ info: FairyScansInfo, source: FairyScans }),
    makeSource({ info: KaganeInfo, source: Kagane }) // <--- AJOUTE CETTE LIGNE
]

// Helper pour créer la source proprement
function makeSource({ info, source }: { info: SourceInfo, source: any }) {
    return {
        info,
        source
    }
}