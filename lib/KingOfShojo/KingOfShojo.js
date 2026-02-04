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
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data ?? '');
        // Sélecteurs standards MangaReader
        const title = $('.entry-title').text().trim();
        const image = $('.thumb img').attr('src') ?? '';
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
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data ?? '');
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
            const chapNum = Number(title.match(/(\d+(\.\d+)?)/)?.[0] ?? 0);
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
        const request = App.createRequest({
            url: `${DOMAIN}${chapterId}`,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data ?? '');
        const pages = [];
        // Sélecteur : #readerarea img
        const images = $('#readerarea img');
        for (const img of images) {
            let url = $(img).attr('src')?.trim();
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
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(query.title ?? '')}`;
        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data ?? '');
        const tiles = [];
        // Sélecteur pour les résultats de recherche (.listupd .bsx)
        const foundItems = $('.listupd .bsx');
        for (const item of foundItems) {
            const link = $(item).find('a');
            const title = link.attr('title') ?? $(item).find('.tt').text().trim();
            const image = $(item).find('img').attr('src') ?? '';
            const href = link.attr('href');
            // Extraction ID : /manga/nom-du-manga/
            const id = href?.split('/manga/')[1]?.replace(/\/$/, '');
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
        const $ = cheerio.load(response.data ?? '');
        // --- A. Section Popular Today ---
        // Trouvé dans ton HTML : <div class="listupd popularslider">
        const popularItems = [];
        for (const item of $('.popularslider .bsx').toArray()) {
            const id = $(item).find('a').attr('href')?.split('/manga/')[1]?.replace(/\/$/, '');
            const title = $(item).find('a').attr('title');
            const image = $(item).find('img').attr('src') ?? '';
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
            const id = $(item).find('a').attr('href')?.split('/manga/')[1]?.replace(/\/$/, '');
            const title = $(item).find('a').attr('title');
            const image = $(item).find('img').attr('src') ?? '';
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
            const id = link.attr('href')?.split('/manga/')[1]?.replace(/\/$/, '');
            const title = link.text().trim();
            const image = $(item).find('.imgseries img').attr('src') ?? '';
            if (id && title) {
                seriesItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }));
            }
        }
        sectionSeries.items = seriesItems;
        sectionCallback(sectionSeries);
    }
}
exports.KingOfShojo = KingOfShojo;
