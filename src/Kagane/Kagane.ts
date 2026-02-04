import {
    Source,
    SourceManga,
    Chapter,
    ChapterDetails,
    SourceInfo,
    ContentRating,
    Request,
    Response,
    SearchRequest,
    PagedResults,
    HomeSection
} from '@paperback/types'
import { KaganeParser } from './KaganeParser'

const KAGANE_API = 'https://api.kagane.org/api/v1'
const KAGANE_DOMAIN = 'https://kagane.org'

export const KaganeInfo: SourceInfo = {
    version: '1.0.5',
    name: 'Kagane',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ton-github',
    description: 'Extension for Kagane.org',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: KAGANE_DOMAIN,
    sourceTags: []
}

export class Kagane extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://kagane.org/'
                }
                return request
            },
            interceptResponse: async (response: Response) => {
                return response
            }
        }
    })

    parser = new KaganeParser()

    get baseUrl(): string {
        return KAGANE_DOMAIN
    }

    // --- Récupérer les infos du Manga ---
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${KAGANE_API}/series/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')

        return this.parser.parseMangaDetails(json, mangaId)
    }

    // --- Récupérer la liste des chapitres ---
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${KAGANE_API}/series/${mangaId}/books`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '[]')

        return this.parser.parseChapterList(json, mangaId)
    }

    // --- Récupérer les images d'un chapitre ---
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${KAGANE_API}/books/${mangaId}/metadata/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '{}')

        return this.parser.parseChapterDetails(json, mangaId, chapterId)
    }

    // --- Recherche ---
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let url = `${KAGANE_API}/series`
        if (query.title) {
            url += `?q=${encodeURIComponent(query.title)}`
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const json = JSON.parse(response.data ?? '[]')

        return this.parser.parseSearchResults(json)
    }

    // --- Page d'accueil (Sections) ---
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Définir les sections
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popular Today', containsMoreItems: true, type: 'singleRowLarge' })
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Latest Series', containsMoreItems: true, type: 'singleRowNormal' })
        
        // Afficher les titres vides tout de suite
        sectionCallback(sectionPopular)
        sectionCallback(sectionLatest)

        // 2. Récupérer le contenu "Populaire"
        // On utilise le tri par vues du jour (trouvé dans le code du site)
        const requestPopular = App.createRequest({
            url: `${KAGANE_API}/series?sort=avg_views_today,desc`,
            method: 'GET'
        })
        const responsePopular = await this.requestManager.schedule(requestPopular, 1)
        const jsonPopular = JSON.parse(responsePopular.data ?? '[]')
        
        // On utilise le parser existant pour transformer le JSON en liste de mangas
        const popularResults = this.parser.parseSearchResults(jsonPopular)
        sectionPopular.items = popularResults.results
        sectionCallback(sectionPopular)

        // 3. Récupérer le contenu "Latest" (Derniers ajouts)
        // Par défaut, l'API /series donne souvent les derniers ajouts
        const requestLatest = App.createRequest({
            url: `${KAGANE_API}/series`,
            method: 'GET'
        })
        const responseLatest = await this.requestManager.schedule(requestLatest, 1)
        const jsonLatest = JSON.parse(responseLatest.data ?? '[]')

        const latestResults = this.parser.parseSearchResults(jsonLatest)
        sectionLatest.items = latestResults.results
        sectionCallback(sectionLatest)
    }
}