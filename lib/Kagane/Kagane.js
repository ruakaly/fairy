"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kagane = exports.KaganeInfo = void 0;
const types_1 = require("@paperback/types");
const cheerio = __importStar(require("cheerio"));
const DOMAIN = 'https://kagane.org';
// On définit les headers ici pour les réutiliser partout
const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
exports.KaganeInfo = {
    version: '1.0.1',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org (Next.js)',
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: DOMAIN
};
class Kagane extends types_1.Source {
    constructor() {
        super(...arguments);
        // Correction : On enlève l'intercepteur ici pour éviter l'erreur de type
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
            requestTimeout: 15000,
        });
    }
    // --- Fonction Magique pour décoder les données Next.js ---
    parseNextJsData(html) {
        const $ = cheerio.load(html);
        // On cherche le bloc qui contient la liste des séries
        try {
            // Extraction brute par regex pour trouver les listes de mangas
            const match = html.match(/"data":\s*(\[\{.*?"id":.*?\}\])/);
            if (match && match[1]) {
                return JSON.parse(match[1]); // Retourne la liste des mangas
            }
        }
        catch (e) {
            console.log('Erreur parsing JSON Next.js');
        }
        return [];
    }
    async getMangaDetails(mangaId) {
        const request = App.createRequest({
            url: `${DOMAIN}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        });
        const response = await this.requestManager.schedule(request, 1);
        const html = response.data ?? '';
        const $ = cheerio.load(html);
        const title = $('h1').text().trim() || 'Titre Inconnu';
        const image = $('img[alt*="cover"]').attr('src') || $('img').first().attr('src') || '';
        const desc = $('p.description').text().trim() || $('div[class*="summary"]').text().trim();
        // Nettoyage URL image
        let finalImage = image;
        if (image.startsWith('/'))
            finalImage = DOMAIN + image;
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: finalImage,
                status: 'Ongoing',
                desc: desc,
            })
        });
    }
    async getChapters(mangaId) {
        // Tentative d'accès à l'API interne pour les chapitres
        const request = App.createRequest({
            url: `${DOMAIN}/api/series/${mangaId}/books`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        });
        const response = await this.requestManager.schedule(request, 1);
        const chapters = [];
        try {
            const json = JSON.parse(response.data ?? '{}');
            const list = Array.isArray(json) ? json : (json.data || json.books || []);
            for (const item of list) {
                chapters.push(App.createChapter({
                    id: item.id,
                    chapNum: Number(item.chapterNumber || item.number || 0),
                    name: item.title || item.name || `Chapter ${item.number}`,
                    langCode: 'en',
                    time: item.createdAt ? new Date(item.createdAt) : new Date()
                }));
            }
        }
        catch (e) {
            console.log(`Erreur chargement chapitres pour ${mangaId}`);
        }
        return chapters;
    }
    async getChapterDetails(mangaId, chapterId) {
        const request = App.createRequest({
            url: `${DOMAIN}/api/books/${chapterId}/pages`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        });
        const response = await this.requestManager.schedule(request, 1);
        let pages = [];
        try {
            const json = JSON.parse(response.data ?? '{}');
            const list = Array.isArray(json) ? json : (json.pages || json.data || []);
            pages = list.map((img) => typeof img === 'string' ? (img.startsWith('http') ? img : DOMAIN + img) : (img.url || img.src));
        }
        catch (e) {
            throw new Error(`Erreur chargement pages chapitre ${chapterId}`);
        }
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    async getSearchResults(query, metadata) {
        const url = `${DOMAIN}/search?q=${encodeURIComponent(query.title ?? '')}`;
        const request = App.createRequest({
            url,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        });
        const response = await this.requestManager.schedule(request, 1);
        const html = response.data ?? '';
        const rawData = this.parseNextJsData(html);
        const tiles = [];
        for (const item of rawData) {
            if (!item.id || !item.name)
                continue;
            let img = item.thumbnail || '';
            if (img && !img.startsWith('http'))
                img = DOMAIN + img;
            tiles.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.name,
                image: img,
                subtitle: undefined
            }));
        }
        return App.createPagedResults({ results: tiles });
    }
    async getHomePageSections(sectionCallback) {
        const section = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' });
        sectionCallback(section);
        const request = App.createRequest({
            url: `${DOMAIN}/search?sort=created_at,desc`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        });
        const response = await this.requestManager.schedule(request, 1);
        const html = response.data ?? '';
        const rawData = this.parseNextJsData(html);
        const mangaList = [];
        for (const item of rawData) {
            if (!item.id || !item.name)
                continue;
            let img = item.thumbnail || item.cover || '';
            if (img && !img.startsWith('http'))
                img = DOMAIN + img;
            mangaList.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.name,
                image: img,
                subtitle: undefined
            }));
        }
        section.items = mangaList;
        sectionCallback(section);
    }
}
exports.Kagane = Kagane;
