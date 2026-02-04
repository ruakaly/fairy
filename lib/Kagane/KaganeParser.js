"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KaganeParser = void 0;
class KaganeParser {
    // --- Parsing des détails du Manga ---
    parseMangaDetails(json, mangaId) {
        var _a, _b;
        const data = json;
        const tags = [];
        if ((_a = data.metadata) === null || _a === void 0 ? void 0 : _a.genres) {
            for (const genre of data.metadata.genres) {
                tags.push(App.createTag({ id: genre, label: genre }));
            }
        }
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [data.name],
                image: `https://api.kagane.org/api/v1/series/${mangaId}/thumbnail`,
                status: data.status,
                author: data.authors ? data.authors.join(', ') : 'Unknown',
                desc: (_b = data.summary) !== null && _b !== void 0 ? _b : 'No description available',
                tags: [App.createTagSection({ id: '0', label: 'genres', tags: tags })]
            })
        });
    }
    // --- Parsing de la liste des Chapitres ---
    parseChapterList(json, mangaId) {
        const chapters = [];
        const list = json.data || json;
        for (const book of list) {
            chapters.push(App.createChapter({
                id: book.id,
                name: book.name || `Chapter ${book.index}`,
                langCode: 'en',
                chapNum: book.index || 0,
                time: book.created ? new Date(book.created) : new Date()
            }));
        }
        return chapters;
    }
    // --- Parsing des Images ---
    parseChapterDetails(json, mangaId, chapterId) {
        const pages = [];
        const token = json.token;
        const imageHost = 'https://ayanami.kagane.org';
        const fileList = json.files || json.pages || [];
        for (const file of fileList) {
            const fileId = typeof file === 'string' ? file : file.id;
            const imageUrl = `${imageHost}/api/v1/books/${mangaId}/file/${chapterId}/${fileId}?token=${token}`;
            pages.push(imageUrl);
        }
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    // --- Parsing des résultats de recherche / Accueil ---
    parseSearchResults(json) {
        const results = [];
        const list = json.data || json;
        for (const item of list) {
            results.push(App.createPartialSourceManga({
                mangaId: item.id,
                image: `https://api.kagane.org/api/v1/series/${item.id}/thumbnail`,
                title: item.name,
                subtitle: undefined
            }));
        }
        return App.createPagedResults({
            results: results
        });
    }
}
exports.KaganeParser = KaganeParser;
