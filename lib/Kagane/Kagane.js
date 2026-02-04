"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kagane = exports.KaganeInfo = void 0;
const types_1 = require("@paperback/types");
const KaganeParser_1 = require("./KaganeParser");
const KAGANE_API = 'https://api.kagane.org/api/v1';
const KAGANE_DOMAIN = 'https://kagane.org';
exports.KaganeInfo = {
    version: '1.0.5',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ton-github',
    description: 'Extension for Kagane.org',
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: KAGANE_DOMAIN,
    sourceTags: []
};
class Kagane extends types_1.Source {
    constructor() {
        super(...arguments);
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
            requestTimeout: 15000,
            interceptor: {
                interceptRequest: async (request) => {
                    var _a;
                    request.headers = {
                        ...((_a = request.headers) !== null && _a !== void 0 ? _a : {}),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://kagane.org/'
                    };
                    return request;
                },
                interceptResponse: async (response) => {
                    return response;
                }
            }
        });
        this.parser = new KaganeParser_1.KaganeParser();
    }
    get baseUrl() {
        return KAGANE_DOMAIN;
    }
    // --- Récupérer les infos du Manga ---
    async getMangaDetails(mangaId) {
        var _a;
        const request = App.createRequest({
            url: `${KAGANE_API}/series/${mangaId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '{}');
        return this.parser.parseMangaDetails(json, mangaId);
    }
    // --- Récupérer la liste des chapitres ---
    async getChapters(mangaId) {
        var _a;
        const request = App.createRequest({
            url: `${KAGANE_API}/series/${mangaId}/books`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '[]');
        return this.parser.parseChapterList(json, mangaId);
    }
    // --- Récupérer les images d'un chapitre ---
    async getChapterDetails(mangaId, chapterId) {
        var _a;
        const request = App.createRequest({
            url: `${KAGANE_API}/books/${mangaId}/metadata/${chapterId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '{}');
        return this.parser.parseChapterDetails(json, mangaId, chapterId);
    }
    // --- Recherche ---
    async getSearchResults(query, metadata) {
        var _a;
        let url = `${KAGANE_API}/series`;
        if (query.title) {
            url += `?q=${encodeURIComponent(query.title)}`;
        }
        const request = App.createRequest({
            url: url,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const json = JSON.parse((_a = response.data) !== null && _a !== void 0 ? _a : '[]');
        return this.parser.parseSearchResults(json);
    }
    // --- Page d'accueil (Sections) ---
    async getHomePageSections(sectionCallback) {
        var _a, _b;
        // 1. Définir les sections
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popular Today', containsMoreItems: true, type: 'singleRowLarge' });
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Latest Series', containsMoreItems: true, type: 'singleRowNormal' });
        // Afficher les titres vides tout de suite
        sectionCallback(sectionPopular);
        sectionCallback(sectionLatest);
        // 2. Récupérer le contenu "Populaire"
        // On utilise le tri par vues du jour (trouvé dans le code du site)
        const requestPopular = App.createRequest({
            url: `${KAGANE_API}/series?sort=avg_views_today,desc`,
            method: 'GET'
        });
        const responsePopular = await this.requestManager.schedule(requestPopular, 1);
        const jsonPopular = JSON.parse((_a = responsePopular.data) !== null && _a !== void 0 ? _a : '[]');
        // On utilise le parser existant pour transformer le JSON en liste de mangas
        const popularResults = this.parser.parseSearchResults(jsonPopular);
        sectionPopular.items = popularResults.results;
        sectionCallback(sectionPopular);
        // 3. Récupérer le contenu "Latest" (Derniers ajouts)
        // Par défaut, l'API /series donne souvent les derniers ajouts
        const requestLatest = App.createRequest({
            url: `${KAGANE_API}/series`,
            method: 'GET'
        });
        const responseLatest = await this.requestManager.schedule(requestLatest, 1);
        const jsonLatest = JSON.parse((_b = responseLatest.data) !== null && _b !== void 0 ? _b : '[]');
        const latestResults = this.parser.parseSearchResults(jsonLatest);
        sectionLatest.items = latestResults.results;
        sectionCallback(sectionLatest);
    }
}
exports.Kagane = Kagane;
