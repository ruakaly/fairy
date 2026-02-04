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

// On définit les headers ici pour les réutiliser partout
const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export const KaganeInfo: SourceInfo = {
    version: '1.0.1',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org (Next.js)',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class Kagane extends Source {
    // Correction : On enlève l'intercepteur ici pour éviter l'erreur de type
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    // --- Fonction Magique pour décoder les données Next.js ---
    parseNextJsData(html: string): any {
        const $ = cheerio.load(html)
        
        // On cherche le bloc qui contient la liste des séries
        try {
            // Extraction brute par regex pour trouver les listes de mangas
            const match = html.match(/"data":\s*(\[\{.*?"id":.*?\}\])/)
            if (match && match[1]) {
                return JSON.parse(match[1]) // Retourne la liste des mangas
            }
        } catch (e) {
            console.log('Erreur parsing JSON Next.js')
        }
        return []
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${DOMAIN}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        })

        const response = await this.requestManager.schedule(request, 1)
        const html = response.data ?? ''
        
        const $ = cheerio.load(html)
        const title = $('h1').text().trim() || 'Titre Inconnu'
        const image = $('img[alt*="cover"]').attr('src') || $('img').first().attr('src') || ''
        const desc = $('p.description').text().trim() || $('div[class*="summary"]').text().trim()

        // Nettoyage URL image
        let finalImage = image
        if (image.startsWith('/')) finalImage = DOMAIN + image
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: finalImage,
                status: 'Ongoing',
                desc: desc,
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // Tentative d'accès à l'API interne pour les chapitres
        const request = App.createRequest({
            url: `${DOMAIN}/api/series/${mangaId}/books`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        })

        const response = await this.requestManager.schedule(request, 1)
        const chapters: Chapter[] = []
        
        try {
            const json = JSON.parse(response.data ?? '{}')
            const list = Array.isArray(json) ? json : (json.data || json.books || [])

            for (const item of list) {
                chapters.push(App.createChapter({
                    id: item.id,
                    chapNum: Number(item.chapterNumber || item.number || 0),
                    name: item.title || item.name || `Chapter ${item.number}`,
                    langCode: 'en',
                    time: item.createdAt ? new Date(item.createdAt) : new Date()
                }))
            }
        } catch (e) {
            console.log(`Erreur chargement chapitres pour ${mangaId}`)
        }
        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${DOMAIN}/api/books/${chapterId}/pages`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        })

        const response = await this.requestManager.schedule(request, 1)
        let pages: string[] = []

        try {
            const json = JSON.parse(response.data ?? '{}')
            const list = Array.isArray(json) ? json : (json.pages || json.data || [])
            
            pages = list.map((img: any) => 
                typeof img === 'string' ? (img.startsWith('http') ? img : DOMAIN + img) : (img.url || img.src)
            )
        } catch (e) {
            throw new Error(`Erreur chargement pages chapitre ${chapterId}`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const url = `${DOMAIN}/search?q=${encodeURIComponent(query.title ?? '')}`
        const request = App.createRequest({ 
            url, 
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        })

        const response = await this.requestManager.schedule(request, 1)
        const html = response.data ?? ''
        
        const rawData = this.parseNextJsData(html)
        const tiles: any[] = []

        for (const item of rawData) {
            if (!item.id || !item.name) continue
            
            let img = item.thumbnail || ''
            if (img && !img.startsWith('http')) img = DOMAIN + img

            tiles.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.name,
                image: img,
                subtitle: undefined
            }))
        }

        return App.createPagedResults({ results: tiles })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })
        sectionCallback(section)

        const request = App.createRequest({
            url: `${DOMAIN}/search?sort=created_at,desc`,
            method: 'GET',
            headers: COMMON_HEADERS // Ajout manuel des headers
        })

        const response = await this.requestManager.schedule(request, 1)
        const html = response.data ?? ''
        
        const rawData = this.parseNextJsData(html)
        const mangaList: any[] = []

        for (const item of rawData) {
            if (!item.id || !item.name) continue

            let img = item.thumbnail || item.cover || ''
            if (img && !img.startsWith('http')) img = DOMAIN + img

            mangaList.push(App.createPartialSourceManga({
                mangaId: item.id,
                title: item.name,
                image: img,
                subtitle: undefined
            }))
        }

        section.items = mangaList
        sectionCallback(section)
    }
}