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

const API_URL = 'https://api.kagane.org/api/v1'
const DOMAIN = 'https://kagane.org'

const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export const KaganeInfo: SourceInfo = {
    version: '1.0.9', // 👈 ON PASSE EN 1.1.0 POUR FORCER L'UPDATE
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class Kagane extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    // 👇 RETOUR A LA SYNTAXE STANDARD (Plus fiable pour l'héritage Paperback)
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            containsMoreItems: true, 
            type: 'singleRowNormal' 
        })
        
        sectionCallback(section)

        const request = App.createRequest({
            url: `${API_URL}/series?page=1&take=20&sort=last_modified&order=desc`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        try {
            const response = await this.requestManager.schedule(request, 1)
            let items: any[] = []
            const json = JSON.parse(response.data ?? '{}')
            
            if (Array.isArray(json)) {
                items = json
            } else if (json.data && Array.isArray(json.data)) {
                items = json.data
            } else if (json.series && Array.isArray(json.series)) {
                items = json.series
            }

            const mangaList: any[] = []
            for (const item of items) {
                let image = item.thumbnail || item.cover || ''
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
            console.log(`Erreur Home: ${e}`)
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
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const chapters: Chapter[] = []

        const rawChapters = json.books || json.chapters || json.data?.books || []

        for (const item of rawChapters) {
            chapters.push(App.createChapter({
                id: String(item.id),
                chapNum: Number(item.chapterNumber || item.number || item.sequenceNumber || 0),
                name: item.title || item.name || `Chapter ${item.number}`,
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
            headers: COMMON_HEADERS
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

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const request = App.createRequest({
            url: `${API_URL}/series?search=${encodeURIComponent(query.title ?? '')}&take=20`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')
        const tiles: any[] = []

        const list = json.data || json.series || []

        for (const item of list) {
            let image = item.thumbnail || ''
            if (image && !image.startsWith('http')) {
                image = `${DOMAIN}/_next/image?url=${encodeURIComponent(image)}&w=384&q=75`
            }

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