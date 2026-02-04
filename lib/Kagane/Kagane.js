"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kagane = exports.KaganeInfo = void 0;
const types_1 = require("@paperback/types");
const API_URL = 'https://api.kagane.org/api/v1';
const DOMAIN = 'https://kagane.org';
const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
exports.KaganeInfo = {
    version: '1.2.0', // 🚀 GRAND SAUT DE VERSION
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension API pour Kagane.org',
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: DOMAIN
};
class Kagane extends types_1.Source {
    constructor() {
        super(...arguments);
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
            requestTimeout: 15000,
        });
    }
    // --- APPROCHE CLASSIQUE (STYLE FAIRYSCANS) ---
    // On déclare la méthode exactement comme dans la définition de type de Paperback
    async getHomePageSections(sectionCallback) {
        // 1. Création section
        const section = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: 'singleRowNormal'
        });
        sectionCallback(section);
        // 2. Requête API
        const request = App.createRequest({
            url: `${API_URL}/series?page=1&take=20&sort=last_modified&order=desc`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        try {
            const response = await this.requestManager.schedule(request, 1);
            let items = [];
            // Parsing sécurisé
            try {
                const json = JSON.parse(response.data ?? '{}');
                if (Array.isArray(json))
                    items = json;
                else if (json.data && Array.isArray(json.data))
                    items = json.data;
                else if (json.series && Array.isArray(json.series))
                    items = json.series;
            }
            catch (e) {
                // Ignore JSON error
            }
            const mangaList = [];
            for (const item of items) {
                // Vérification stricte des données
                if (!item.id || (!item.title && !item.name))
                    continue;
                let image = item.thumbnail || item.cover || '';
                if (image && !image.startsWith('http')) {
                    image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`;
                }
                mangaList.push(App.createPartialSourceManga({
                    mangaId: String(item.id),
                    title: item.title || item.name || 'Unknown',
                    image: image,
                    subtitle: undefined
                }));
            }
            section.items = mangaList;
            sectionCallback(section);
        }
        catch (e) {
            console.log(`Kagane Error: ${e}`);
            // Important : on renvoie la section même vide pour dire "c'est fini"
            sectionCallback(section);
        }
    }
    async getMangaDetails(mangaId) {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse(response.data ?? '{}');
        const data = json.data || json;
        let image = data.thumbnail || '';
        if (image && !image.startsWith('http')) {
            image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`;
        }
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [data.title || data.name || 'Unknown'],
                image: image,
                status: 'Ongoing',
                desc: data.summary || data.description || '',
                tags: []
            })
        });
    }
    async getChapters(mangaId) {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse(response.data ?? '{}');
        const chapters = [];
        const list = json.books || json.chapters || json.data?.books || [];
        for (const item of list) {
            chapters.push(App.createChapter({
                id: String(item.id),
                chapNum: Number(item.chapterNumber || 0),
                name: item.title || `Chapter ${item.chapterNumber}`,
                langCode: 'en',
                time: new Date()
            }));
        }
        return chapters;
    }
    async getChapterDetails(mangaId, chapterId) {
        const request = App.createRequest({
            url: `${API_URL}/books/${mangaId}/file/${chapterId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse(response.data ?? '{}');
        let pages = [];
        const list = Array.isArray(json) ? json : (json.images || json.data || []);
        pages = list.map((x) => typeof x === 'string' ? x : x.url);
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    async getSearchResults(query, metadata) {
        const request = App.createRequest({
            url: `${API_URL}/series?search=${encodeURIComponent(query.title ?? '')}`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse(response.data ?? '{}');
        const tiles = [];
        const list = json.data || json.series || [];
        for (const item of list) {
            let image = item.thumbnail || '';
            if (image && !image.startsWith('http'))
                image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}`;
            tiles.push(App.createPartialSourceManga({
                mangaId: String(item.id),
                title: item.title || item.name,
                image: image,
                subtitle: undefined
            }));
        }
        return App.createPagedResults({ results: tiles });
    }
}
exports.Kagane = Kagane;
