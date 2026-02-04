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
    version: '1.0.9',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org',
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
    // --- CORRECTION MAJEURE ICI ---
    // On s'assure que la fonction est bien déclarée comme async et retourne Promise<void>
    // C'est exactement le format standard
    async getHomePageSections(sectionCallback) {
        // 1. On crée la section VIDE d'abord (pour que l'UI réagisse vite)
        const section = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: 'singleRowNormal'
        });
        // 2. On l'affiche tout de suite
        sectionCallback(section);
        // 3. Ensuite on va chercher les données
        const request = App.createRequest({
            url: `${API_URL}/series?page=1&take=20&sort=last_modified&order=desc`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        try {
            const response = await this.requestManager.schedule(request, 1);
            let items = [];
            const json = JSON.parse(response.data ?? '{}');
            // Sécurité : on vérifie tous les formats possibles
            if (Array.isArray(json)) {
                items = json;
            }
            else if (json.data && Array.isArray(json.data)) {
                items = json.data;
            }
            else if (json.series && Array.isArray(json.series)) {
                items = json.series;
            }
            const mangaList = [];
            for (const item of items) {
                let image = item.thumbnail || item.cover || '';
                if (image && !image.startsWith('http')) {
                    image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`;
                }
                // On vérifie que l'ID existe bien avant d'ajouter
                if (item.id) {
                    mangaList.push(App.createPartialSourceManga({
                        mangaId: String(item.id),
                        title: item.title || item.name || 'Unknown',
                        image: image,
                        subtitle: undefined
                    }));
                }
            }
            // 4. On met à jour la section avec les items trouvés
            section.items = mangaList;
            sectionCallback(section);
        }
        catch (e) {
            console.log(`Erreur Home: ${e}`);
            // En cas d'erreur, on renvoie la section vide pour ne pas crasher
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
                titles: [data.title || data.name || 'Titre Inconnu'],
                image: image,
                status: data.status === 'ONGOING' ? 'Ongoing' : 'Completed',
                desc: data.summary || data.description || '',
                artist: data.authors ? data.authors.join(', ') : '',
                tags: data.metadata?.genres || []
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
        const rawChapters = json.books || json.chapters || json.data?.books || [];
        for (const item of rawChapters) {
            chapters.push(App.createChapter({
                id: String(item.id),
                chapNum: Number(item.chapterNumber || item.number || item.sequenceNumber || 0),
                name: item.title || item.name || `Chapter ${item.number}`,
                langCode: 'en',
                time: item.createdAt ? new Date(item.createdAt) : new Date()
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
        if (Array.isArray(json)) {
            pages = json;
        }
        else if (Array.isArray(json.images)) {
            pages = json.images;
        }
        else if (Array.isArray(json.pages)) {
            pages = json.pages;
        }
        else if (Array.isArray(json.data)) {
            pages = json.data;
        }
        pages = pages.map((img) => typeof img === 'string' ? img : img.url);
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    async getSearchResults(query, metadata) {
        const request = App.createRequest({
            url: `${API_URL}/series?search=${encodeURIComponent(query.title ?? '')}&take=20`,
            method: 'GET',
            headers: COMMON_HEADERS
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse(response.data ?? '{}');
        const tiles = [];
        const list = json.data || json.series || [];
        for (const item of list) {
            let image = item.thumbnail || '';
            if (image && !image.startsWith('http')) {
                image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`;
            }
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
