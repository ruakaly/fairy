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
    version: '1.2.4', // ⬆️ Nouvelle version
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension Multi-Sections pour Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class Kagane extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    // --- SCANNER HTML AMÉLIORÉ ---
    parseHtmlList(html: string): any[] {
        const $ = cheerio.load(html)
        const items: any[] = []
        
        // On cherche plus large : series, comic, ou juste des liens dans des "cards"
        $('a[href*="/series/"], a[href*="/comic/"]').each((i, el) => {
            const href = $(el).attr('href')
            const id = href?.split('/').pop()
            
            // Titre : On cherche partout
            const title = $(el).find('h3, h4, .title, span, p').first().text().trim() || $(el).attr('title') || $(el).text().trim()
            
            // Image : On cherche l'image la plus proche
            let image = $(el).find('img').attr('src') || $(el).find('img').attr('srcset')?.split(' ')[0] || ''
            
            // Si pas d'image dans le lien, on regarde le parent (cas fréquent des "cards")
            if (!image) {
                image = $(el).closest('div').find('img').first().attr('src') || ''
            }

            // Nettoyage URL Image
            if (image) {
                if (image.startsWith('/')) image = DOMAIN + image
                if (image.includes('url=')) {
                    const match = image.match(/url=(.*?)&/)
                    if (match) image = decodeURIComponent(match[1])
                    if (image.startsWith('/')) image = DOMAIN + image
                }
            } else {
                image = 'https://kagane.org/favicon.ico' // Image par défaut
            }

            if (id && title && title.length < 100) { // Sécurité longueur titre
                if (!items.find(x => x.id === id)) {
                    items.push({ id, title, image })
                }
            }
        })
        return items
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // SECTION 1 : POPULAR
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popular Manga', containsMoreItems: true, type: 'singleRowNormal' })
        
        // SECTION 2 : LATEST (Souvent plus fiable)
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })
        
        sectionCallback(sectionPopular)
        sectionCallback(sectionLatest)

        // --- Remplissage Popular ---
        // Essai API tri par 'views'
        const requestPopular = App.createRequest({
            url: `${API_URL}/series?sort=views&order=desc&page=1&take=10`,
            method: 'GET',
            headers: COMMON_HEADERS
        })
        
        this.fetchSectionData(requestPopular, sectionPopular, sectionCallback)

        // --- Remplissage Latest ---
        // Essai API tri par 'last_modified' (Le plus sûr)
        const requestLatest = App.createRequest({
            url: `${API_URL}/series?sort=last_modified&order=desc&page=1&take=10`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        this.fetchSectionData(requestLatest, sectionLatest, sectionCallback)
    }

    // Fonction d'aide pour éviter de répéter le code
    async fetchSectionData(request: Request, section: HomeSection, callback: (section: HomeSection) => void) {
        try {
            const response = await this.requestManager.schedule(request, 1)
            let items: any[] = []
            
            try {
                const json = JSON.parse(response.data ?? '{}')
                if (Array.isArray(json)) items = json
                else if (json.data && Array.isArray(json.data)) items = json.data
                else if (json.series && Array.isArray(json.series)) items = json.series
            } catch (e) {}

            // FALLBACK HTML si l'API est vide
            if (items.length === 0) {
                const htmlRequest = App.createRequest({
                    url: `${DOMAIN}/search?sort=created_at,desc`, // Page de recherche standard
                    method: 'GET',
                    headers: COMMON_HEADERS
                })
                const htmlResponse = await this.requestManager.schedule(htmlRequest, 1)
                items = this.parseHtmlList(htmlResponse.data ?? '')
            }

            const mangaList: any[] = []
            for (const item of items) {
                if (!item.id) continue

                let image = item.thumbnail || item.cover || item.image || ''
                if (image && !image.startsWith('http')) {
                    image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
                } else if (!image) {
                     image = 'https://kagane.org/favicon.ico'
                }

                mangaList.push(App.createPartialSourceManga({
                    mangaId: String(item.id),
                    title: item.title || item.name || 'Unknown',
                    image: image,
                    subtitle: undefined
                }))
            }
            
            section.items = mangaList
            callback(section)

        } catch (e) {
            console.log(`Erreur Section ${section.id}: ${e}`)
            callback(section)
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
                artist: data.authors ? data.authors.join(', ') : '',
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