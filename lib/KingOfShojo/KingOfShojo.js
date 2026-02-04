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
exports.KingOfShojo = exports.KingOfShojoInfo = void 0;
const types_1 = require("@paperback/types");
const cheerio = __importStar(require("cheerio"));
const DOMAIN = 'https://kingofshojo.com';
exports.KingOfShojoInfo = {
    version: '1.0.0',
    name: 'KingOfShojo',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour lire KingOfShojo sur Paperback',
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: DOMAIN
};
class KingOfShojo extends types_1.Source {
    constructor() {
        super(...arguments);
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 3,
            requestTimeout: 15000,
        });
    }
    async getMangaDetails(mangaId) {
        var _a, _b;
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load((_a = response.data) !== null && _a !== void 0 ? _a : '');
        // Sélecteurs standards MangaReader
        const title = $('.entry-title').text().trim();
        const image = (_b = $('.thumb img').attr('src')) !== null && _b !== void 0 ? _b : '';
        const description = $('.entry-content p').text().trim();
        let status = 'Ongoing';
        // Recherche du statut dans les infos
        const statusText = $('.imptdt:contains("Status") i').text().trim().toLowerCase();
        if (statusText.includes('completed'))
            status = 'Completed';
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                desc: description,
            })
        });
    }
    async getChapters(mangaId) {
        var _a, _b, _c;
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load((_a = response.data) !== null && _a !== void 0 ? _a : '');
        const chapters = [];
        // Sélecteur : #chapterlist li
        const chapterNodes = $('#chapterlist li');
        for (const node of chapterNodes) {
            const link = $(node).find('a');
            const title = $(node).find('.chapternum').text().trim() || link.text().trim();
            const href = link.attr('href');
            // Extraction de l'ID depuis l'URL
            const id = href ? href.replace(DOMAIN, '') : '';
            if (!id)
                continue;
            // Extraction numéro (ex: "Chapter 12" -> 12)
            const chapNum = Number((_c = (_b = title.match(/(\d+(\.\d+)?)/)) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : 0);
            const timeStr = $(node).find('.chapterdate').text().trim();
            const time = new Date(timeStr);
            chapters.push(App.createChapter({
                id: id,
                chapNum: chapNum,
                name: title,
                langCode: 'en', // Site en anglais
                time: isNaN(time.getTime()) ? new Date() : time
            }));
        }
        return chapters;
    }
    async getChapterDetails(mangaId, chapterId) {
        var _a, _b;
        const request = App.createRequest({
            url: `${DOMAIN}${chapterId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load((_a = response.data) !== null && _a !== void 0 ? _a : '');
        const pages = [];
        // Sélecteur : #readerarea img
        const images = $('#readerarea img');
        for (const img of images) {
            let url = (_b = $(img).attr('src')) === null || _b === void 0 ? void 0 : _b.trim();
            if (url)
                pages.push(url);
        }
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    async getSearchResults(query, metadata) {
        var _a, _b, _c, _d, _e;
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent((_a = query.title) !== null && _a !== void 0 ? _a : '')}`;
        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load((_b = response.data) !== null && _b !== void 0 ? _b : '');
        const tiles = [];
        // Sélecteur pour les résultats de recherche (.listupd .bsx)
        const foundItems = $('.listupd .bsx');
        for (const item of foundItems) {
            const link = $(item).find('a');
            const title = (_c = link.attr('title')) !== null && _c !== void 0 ? _c : $(item).find('.tt').text().trim();
            const image = (_d = $(item).find('img').attr('src')) !== null && _d !== void 0 ? _d : '';
            const href = link.attr('href');
            // Extraction ID : /manga/nom-du-manga/
            const id = (_e = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _e === void 0 ? void 0 : _e.replace(/\/$/, '');
            if (id && title) {
                tiles.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }));
            }
        }
        return App.createPagedResults({
            results: tiles
        });
    }
    async getHomePageSections(sectionCallback) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        // 1. Définition des sections (Basé sur ton HTML)
        const sectionPopular = App.createHomeSection({ id: 'popular_today', title: 'Popular Today', containsMoreItems: false, type: 'singleRowLarge' });
        const sectionLatest = App.createHomeSection({ id: 'latest_update', title: 'Latest Update', containsMoreItems: true, type: 'singleRowNormal' });
        const sectionSeries = App.createHomeSection({ id: 'popular_series', title: 'Popular Series', containsMoreItems: false, type: 'singleRowNormal' });
        sectionCallback(sectionPopular);
        sectionCallback(sectionLatest);
        sectionCallback(sectionSeries);
        // 2. Requête Page d'accueil
        const request = App.createRequest({
            url: DOMAIN,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load((_a = response.data) !== null && _a !== void 0 ? _a : '');
        // --- A. Section Popular Today ---
        // Trouvé dans ton HTML : <div class="listupd popularslider">
        const popularItems = [];
        for (const item of $('.popularslider .bsx').toArray()) {
            const id = (_c = (_b = $(item).find('a').attr('href')) === null || _b === void 0 ? void 0 : _b.split('/manga/')[1]) === null || _c === void 0 ? void 0 : _c.replace(/\/$/, '');
            const title = $(item).find('a').attr('title');
            const image = (_d = $(item).find('img').attr('src')) !== null && _d !== void 0 ? _d : '';
            if (id && title) {
                popularItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }));
            }
        }
        sectionPopular.items = popularItems;
        sectionCallback(sectionPopular);
        // --- B. Section Latest Update ---
        // Trouvé dans ton HTML : <div class="postbody"> ... <div class="listupd">
        const latestItems = [];
        for (const item of $('.postbody .listupd .bsx').toArray()) {
            const id = (_f = (_e = $(item).find('a').attr('href')) === null || _e === void 0 ? void 0 : _e.split('/manga/')[1]) === null || _f === void 0 ? void 0 : _f.replace(/\/$/, '');
            const title = $(item).find('a').attr('title');
            const image = (_g = $(item).find('img').attr('src')) !== null && _g !== void 0 ? _g : '';
            if (id && title) {
                latestItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }));
            }
        }
        sectionLatest.items = latestItems;
        sectionCallback(sectionLatest);
        // --- C. Section Popular Series (Sidebar) ---
        // Trouvé dans ton HTML : <div id="sidebar"> ... <div class='serieslist pop wpop wpop-weekly'>
        const seriesItems = [];
        for (const item of $('#sidebar .serieslist.pop ul li').toArray()) {
            const link = $(item).find('.leftseries h2 a');
            const id = (_j = (_h = link.attr('href')) === null || _h === void 0 ? void 0 : _h.split('/manga/')[1]) === null || _j === void 0 ? void 0 : _j.replace(/\/$/, '');
            const title = link.text().trim();
            const image = (_k = $(item).find('.imgseries img').attr('src')) !== null && _k !== void 0 ? _k : '';
            if (id && title) {
                seriesItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }));
            }
        }
        sectionSeries.items = seriesItems;
        sectionCallback(sectionSeries);
    }
}
exports.KingOfShojo = KingOfShojo;
