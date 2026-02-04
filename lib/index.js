"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sources = void 0;
// Importe tes extensions ici
const FairyScans_1 = require("./FairyScans/FairyScans");
const Kagane_1 = require("./Kagane/Kagane"); // <--- AJOUTE CETTE LIGNE
// Ajoute KaganeInfo et Kagane dans les listes ci-dessous
exports.Sources = [
    makeSource({ info: FairyScans_1.FairyScansInfo, source: FairyScans_1.FairyScans }),
    makeSource({ info: Kagane_1.KaganeInfo, source: Kagane_1.Kagane }) // <--- AJOUTE CETTE LIGNE
];
// Helper pour créer la source proprement
function makeSource({ info, source }) {
    return {
        info,
        source
    };
}
