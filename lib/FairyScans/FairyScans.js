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
exports.FairyScans = exports.FairyScansInfo = void 0;
const types_1 = require("@paperback/types");
const cheerio = __importStar(require("cheerio"));
const DOMAIN = 'https://fairyscans.com';
exports.FairyScansInfo = {
    version: '1.0.8', // J'ai monté la version pour l'update
    name: 'FairyScans',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension Paperback pour FairyScans',
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: DOMAIN
};
class FairyScans extends types_1.Source {
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
        const title = $('.entry-title').text().trim();
        const image = $('.thumb img').attr('src') ?? '';
        const description = $('.entry-content p').text().trim();
        let status = 'Ongoing';
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
        const chapterNodes = $('#chapterlist li');
        for (const node of chapterNodes) {
            const link = $(node).find('a');
            const title = $(node).find('.chapternum').text().trim() || link.text().trim();
            const href = link.attr('href');
            const id = href ? href.replace(DOMAIN, '') : '';
            if (!id)
                continue;
            const chapNum = Number(title.match(/(\d+(\.\d+)?)/)?.[0] ?? 0);
            const timeStr = $(node).find('.chapterdate').text().trim();
            const time = new Date(timeStr);
            chapters.push(App.createChapter({
                id: id,
                chapNum: chapNum,
                name: title,
                langCode: 'en', // FairyScans semble être en anglais principalement
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
        const foundItems = $('.listupd .bsx');
        for (const item of foundItems) {
            const link = $(item).find('a');
            const title = link.attr('title') ?? $(item).find('.tt').text().trim();
            const image = $(item).find('img').attr('src') ?? '';
            const href = link.attr('href');
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
        // 1. Définition des sections (Titres en Anglais)
        const sectionPopular = App.createHomeSection({ id: 'popular_today', title: 'Popular Today', containsMoreItems: false, type: 'singleRowLarge' });
        const sectionSeries = App.createHomeSection({ id: 'popular_series', title: 'Popular Series', containsMoreItems: false, type: 'singleRowNormal' });
        const sectionLatest = App.createHomeSection({ id: 'latest_update', title: 'Latest Update', containsMoreItems: true, type: 'singleRowNormal' });
        // Affichage immédiat des titres
        sectionCallback(sectionPopular);
        sectionCallback(sectionSeries);
        sectionCallback(sectionLatest);
        // 2. Requête vers la page d'accueil
        const request = App.createRequest({
            url: DOMAIN,
            method: 'GET'
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data ?? '');
        // --- A. Section Popular Today ---
        // Sélecteur : Slider du haut (.popularslider)
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
        // --- B. Section Popular Series ---
        // Sélecteur : La liste dans la sidebar (.serieslist.pop)
        const seriesItems = [];
        for (const item of $('.serieslist.pop ul li').toArray()) {
            // Dans la sidebar, l'image est dans .imgseries et le titre dans .leftseries h2 a
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
        // --- C. Section Latest Update ---
        // Sélecteur : Le corps principal (.postbody .listupd)
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
    }
}
exports.FairyScans = FairyScans;
