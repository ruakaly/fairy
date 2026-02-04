import {
    Source,
    SourceManga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    Request,
    Response,
} from '@paperback/types'
import * as cheerio from 'cheerio'

const DOMAIN = 'https://kagane.org'
const API_URL = 'https://api.kagane.org/api/v1'

// ✅ CORRECTION : On définit les headers ici pour les utiliser partout
const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN
}

export const KaganeInfo: SourceInfo = {
    version: '1.0.4',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class Kagane extends Source {
    // ✅ CORRECTION : On supprime le bloc "interceptor" qui causait l'erreur
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS // ✅ On ajoute les headers manuellement
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const data = json.data || json

        // Gestion de l'image
        let image = data.thumbnail || ''
        if (image && !image.startsWith('http')) {
            image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
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
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS // ✅ Headers ajoutés
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const chapters: Chapter[] = []

        const rawChapters = json.books || json.chapters || json.data?.books || []

        for (const item of rawChapters) {
            chapters.push(App.createChapter({
                id: item.id,
                chapNum: Number(item.chapterNumber || item.sequenceNumber || item.number || 0),
                name: item.title || item.name || `Chapter ${item.chapterNumber}`,
                langCode: 'en',
                time: item.createdAt ? new Date(item.createdAt) : new Date()
            }))
        }
        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${API_URL}/books/${mangaId}/file/${chapterId}`,
            method: 'GET',
            headers: COMMON_HEADERS // ✅ Headers ajoutés
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')

        let pages: string[] = []
        
        if (Array.isArray(json)) {
            pages = json
        } else if (Array.isArray(json.images)) {
            pages = json.images
        } else if (Array.isArray(json.pages)) {
            pages = json.pages
        } else if (Array.isArray(json.data)) {
            pages = json.data
        }

        pages = pages.map((img: any) => typeof img === 'string' ? img : img.url)

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })
        sectionCallback(section)

        const request = App.createRequest({
            url: `${API_URL}/series?sort=last_modified&order=desc&take=20`,
            method: 'GET',
            headers: COMMON_HEADERS // ✅ Headers ajoutés
        })

        const response = await this.requestManager.schedule(request, 1)
        
        const mangaList: any[] = []
        let list: any[] = []
        
        try {
            const json = JSON.parse(response.data ?? '{}')
            list = json.data || json.series || []
        } catch (e) {
            console.log("Erreur parsing home")
        }

        for (const item of list) {
            let image = item.thumbnail || ''
            if (image && !image.startsWith('http')) {
                image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
            }

            mangaList.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.title || item.name,
                image: image,
                subtitle: undefined
            }))
        }

        section.items = mangaList
        sectionCallback(section)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const request = App.createRequest({
            url: `${API_URL}/series?search=${encodeURIComponent(query.title ?? '')}`,
            method: 'GET',
            headers: COMMON_HEADERS // ✅ Headers ajoutés
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const tiles: any[] = []

        for (const item of (json.data || [])) {
            let image = item.thumbnail || ''
            if (image && !image.startsWith('http')) {
                image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
            }

            tiles.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.title || item.name,
                image: image,
                subtitle: undefined
            }))
        }

        return App.createPagedResults({ results: tiles })
    }
}