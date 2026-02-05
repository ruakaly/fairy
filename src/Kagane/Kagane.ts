import {
    Source,
    SourceManga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagSection,
    ContentRating,
    Request,
    Response
} from '@paperback/types'

// Cette ligne est cruciale : elle dit à TypeScript que "App" existe globalement
declare const App: any

const API_URL = 'https://api.kagane.org/api/v1'
const BASE_URL = 'https://kagane.org'

export const KaganeInfo: SourceInfo = {
    version: '1.0.0',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Nad',
    authorWebsite: 'https://github.com/ruakaly',
    description: 'Extension pour Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: BASE_URL,
    sourceTags: []
}

export class Kagane extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': BASE_URL,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${BASE_URL}/series/${mangaId}`
    }

    // 1. Récupération des détails via l'API
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${API_URL}/series/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        // On s'assure d'avoir un texte valide avant de parser
        const dataStr = response.data ?? '{}'
        const json = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr

        const tags: TagSection[] = []
        if (json.genres) {
            tags.push(App.createTagSection({
                id: '0',
                label: 'Genres',
                tags: json.genres.map((g: string) => App.createTag({ id: g, label: g }))
            }))
        }

        let status = 'Ongoing'
        if (json.status === 'ENDED') status = 'Completed'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [json.name],
                image: `${API_URL}/series/${mangaId}/thumbnail`,
                status: status,
                author: json.authors ? json.authors.join(', ') : 'Unknown',
                desc: json.summary ?? '',
                tags: tags
            })
        })
    }

    // 2. Récupération des chapitres via le HTML (Regex)
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${BASE_URL}/series/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const dataStr = response.data ?? ''
        
        // On cherche le bloc de données caché "initialBooksData"
        const regex = /\\"initialBooksData\\":(\[.*?\])(?:,\\"|})/
        const match = dataStr.match(regex)
        
        const chapters: Chapter[] = []

        if (match && match[1]) {
            // Nettoyage du JSON (remplacer les \" par ")
            const cleanJson = match[1].replace(/\\"/g, '"')
            
            try {
                const data = JSON.parse(cleanJson)

                for (const chapter of data) {
                    const chapterId = chapter.id
                    const chapNum = chapter.metadata?.numberSort ?? 0
                    const title = chapter.name ? chapter.name : `Episode ${chapNum}`
                    const dateStr = chapter.metadata?.releaseDate

                    chapters.push(App.createChapter({
                        id: chapterId,
                        name: title,
                        chapNum: Number(chapNum),
                        langCode: 'en',
                        time: dateStr ? new Date(dateStr) : new Date()
                        // Pas de mangaId ici selon ton erreur précédente
                    }))
                }
            } catch (e) {
                console.log(`Erreur parsing chapitres: ${e}`)
            }
        }

        return chapters
    }

    // 3. Récupération des images
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${BASE_URL}/series/${mangaId}/reader/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const dataStr = response.data ?? ''
        
        const pages: string[] = []
        
        // Regex pour trouver des urls d'images dans le code source
        const imageRegex = /(https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp))/g
        const matches = dataStr.match(imageRegex)

        if (matches) {
            const uniqueImages = [...new Set(matches)] as string[]
            
            for (const img of uniqueImages) {
                if (!img.includes('icon') && !img.includes('logo') && !img.includes('thumbnail')) {
                    pages.push(img)
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // Recherche
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${API_URL}/series/search`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                query: query.title ?? '',
                page: page,
                size: 20
            })
        })

        const response = await this.requestManager.schedule(request, 1)
        const dataStr = response.data ?? '{}'
        const json = JSON.parse(dataStr)
        const results = json.data ?? []

        const tiles = results.map((item: any) => App.createPartialSourceManga({
            title: item.name,
            image: `${API_URL}/series/${item.id}/thumbnail`,
            mangaId: item.id,
            subtitle: undefined
        }))

        return App.createPagedResults({
            results: tiles,
            metadata: { page: page + 1 }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ id: 'latest', title: 'Latest Series', containsMoreItems: false, type: 'singleRowNormal' })
        sectionCallback(section)
        
        try {
             const listRequest = App.createRequest({
                url: `${API_URL}/series?page=0&size=20&sort=latest`,
                method: 'GET'
            })
            const response = await this.requestManager.schedule(listRequest, 1)
            const dataStr = response.data ?? '{}'
            const json = JSON.parse(dataStr)
            
            const tiles = json.data.map((item: any) => App.createPartialSourceManga({
                title: item.name,
                image: `${API_URL}/series/${item.id}/thumbnail`,
                mangaId: item.id,
                subtitle: undefined
            }))
            
            section.items = tiles
            sectionCallback(section)
        } catch (e) {
            console.log('Erreur Home Section: ' + e)
        }
    }
}