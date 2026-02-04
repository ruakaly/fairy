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

const API_URL = 'https://api.kagane.org/api/v1'
const DOMAIN = 'https://kagane.org'

const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export const KaganeInfo: SourceInfo = {
    version: '1.2.3', // ⬆️ Nouvelle version
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension Hybride pour Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class Kagane extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    // --- FONCTION DE SECOURS (Lit le HTML si l'API échoue) ---
    parseHtmlList(html: string): any[] {
        const $ = cheerio.load(html)
        const items: any[] = []
        
        // On cherche tous les liens qui mènent vers une série
        $('a[href^="/series/"]').each((i, el) => {
            const id = $(el).attr('href')?.split('/').pop()
            // Titre : souvent dans un h3, h4 ou div enfant
            const title = $(el).find('h3, h4, .title, span.font-bold').first().text().trim() || $(el).text().trim()
            // Image : cherche la balise img
            let image = $(el).find('img').attr('src') || $(el).find('img').attr('srcset')?.split(' ')[0] || ''
            
            // Nettoyage image (Next.js optimise souvent les urls)
            if (image.startsWith('/')) image = DOMAIN + image
            if (image.includes('url=')) {
                // Décodage de l'url Next.js: /_next/image?url=%2Fcover.jpg
                const match = image.match(/url=(.*?)&/)
                if (match) image = decodeURIComponent(match[1])
                if (image.startsWith('/')) image = DOMAIN + image
            }

            if (id && title) {
                // On évite les doublons
                if (!items.find(x => x.id === id)) {
                    items.push({ id, title, image })
                }
            }
        })
        return items
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Manga', 
            containsMoreItems: true, 
            type: 'singleRowNormal' 
        })
        sectionCallback(section)

        // STRATÉGIE 1 : L'API "Popular"
        const apiRequest = App.createRequest({
            url: `${API_URL}/series?sort=views&order=desc&page=1&take=20`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        try {
            const response = await this.requestManager.schedule(apiRequest, 1)
            let items: any[] = []
            
            try {
                const json = JSON.parse(response.data ?? '{}')
                if (Array.isArray(json)) items = json
                else if (json.data && Array.isArray(json.data)) items = json.data
                else if (json.series && Array.isArray(json.series)) items = json.series
            } catch (e) {}

            // SI L'API EST VIDE -> STRATÉGIE 2 : HTML DU SITE
            if (items.length === 0) {
                console.log('API vide, passage au mode HTML...')
                const htmlRequest = App.createRequest({
                    // On demande la page de recherche triée par vues (ou défaut)
                    url: `${DOMAIN}/search?sort=views,desc`,
                    method: 'GET',
                    headers: COMMON_HEADERS
                })
                const htmlResponse = await this.requestManager.schedule(htmlRequest, 1)
                items = this.parseHtmlList(htmlResponse.data ?? '')
            }

            const mangaList: any[] = []
            for (const item of items) {
                let image = item.thumbnail || item.cover || item.image || ''
                if (image && !image.startsWith('http')) {
                    image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
                }

                if (item.id) {
                    mangaList.push(App.createPartialSourceManga({
                        mangaId: String(item.id),
                        title: item.title || item.name || 'Unknown',
                        image: image,
                        subtitle: undefined
                    }))
                }
            }
            section.items = mangaList
            sectionCallback(section)

        } catch (e) {
            console.log(`Erreur globale Home: ${e}`)
            sectionCallback(section) 
        }
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const data = json.data || json

        let image = data.thumbnail || ''
        if (image && !image.startsWith('http')) {
            image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
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
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const chapters: Chapter[] = []
        const list = json.books || json.chapters || json.data?.books || []

        for (const item of list) {
            chapters.push(App.createChapter({
                id: String(item.id),
                chapNum: Number(item.chapterNumber || item.number || 0),
                name: item.title || `Chapter ${item.number}`,
                langCode: 'en',
                time: new Date()
            }))
        }
        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${API_URL}/books/${mangaId}/file/${chapterId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        let pages: string[] = []
        
        const list = Array.isArray(json) ? json : (json.images || json.data || [])
        pages = list.map((x: any) => typeof x === 'string' ? x : x.url)

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // Recherche : On tente l'API
        const request = App.createRequest({
            url: `${API_URL}/series?search=${encodeURIComponent(query.title ?? '')}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        let items: any[] = []
        try {
            const json = JSON.parse(response.data ?? '{}')
            items = json.data || json.series || []
        } catch(e) {}

        const tiles: any[] = []
        for (const item of items) {
            let image = item.thumbnail || ''
            if (image && !image.startsWith('http')) image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}`
            
            tiles.push(App.createPartialSourceManga({
                mangaId: String(item.id),
                title: item.title || item.name,
                image: image,
                subtitle: undefined
            }))
        }
        return App.createPagedResults({ results: tiles })
    }
}