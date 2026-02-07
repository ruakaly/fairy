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

const API_BASE = 'https://akaicomic.org/api'
const DOMAIN = 'https://akaicomic.org'

export const AkaiComicInfo: SourceInfo = {
    version: '1.0.1',
    name: 'AkaiComic',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruakaly',
    description: 'Extension API pour AkaiComic',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class AkaiComic extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
    })

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${API_BASE}/manga/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}').manga

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [data.series_name],
                image: data.cover_url ?? '',
                status: data.status?.toLowerCase().includes('releasing') ? 'Ongoing' : 'Completed',
                desc: data.description ?? '',
                author: data.author,
                artist: data.artist,
                tags: [App.createTagSection({
                    id: 'genres',
                    label: 'genres',
                    tags: (data.genres?.split(',') ?? []).map((g: string) => App.createTag({ id: g.trim(), label: g.trim() }))
                })]
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${API_BASE}/manga/${mangaId}/chapters`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters: Chapter[] = []
        for (const chap of data.chapters ?? []) {
            chapters.push(App.createChapter({
                id: chap.chapter_number.toString(),
                chapNum: chap.chapter_number,
                name: chap.title || `Chapter ${chap.chapter_number}`,
                langCode: 'en',
                time: new Date(chap.created_at)
            }))
        }
        return chapters
    }

   async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${API_BASE}/manga/${mangaId}/chapter/${chapterId}/pages`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')

        // On transforme les URLs relatives en URLs absolues
        const pages: string[] = (data.pages ?? []).map((page: string) => {
            if (page.startsWith('http')) return page // Déjà absolue
            return `${DOMAIN}${page.startsWith('/') ? '' : '/'}${page}`
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const url = `${API_BASE}/manga/list?limit=20&page=${page}`
        
        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const results = []

        for (const manga of data.manga ?? []) {
            results.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: manga.cover_url,
                title: manga.series_name,
                subtitle: manga.type
            }))
        }

        return App.createPagedResults({
            results: results,
            metadata: { page: page + 1 }
        })
    }

    // Suppression du "s" en trop si présent : getHomePageSections
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Définition des sections
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Most Popular', containsMoreItems: false, type: 'singleRowLarge' })
        const sectionNew = App.createHomeSection({ id: 'new', title: 'New Series', containsMoreItems: false, type: 'singleRowNormal' })
        const sectionUpdates = App.createHomeSection({ id: 'updates', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })

        // 2. Affichage immédiat des squelettes de sections
        sectionCallback(sectionPopular)
        sectionCallback(sectionNew)
        sectionCallback(sectionUpdates)

        // 3. Récupération "Most Popular"
        const popularReq = App.createRequest({
            url: `${DOMAIN}/api/series/top?limit=6`,
            method: 'GET'
        })
        this.requestManager.schedule(popularReq, 1).then(res => {
            const data = JSON.parse(res.data ?? '{}')
            sectionPopular.items = (data.series ?? []).map((m: any) => App.createPartialSourceManga({
                mangaId: m.id,
                image: m.cover_url,
                title: m.series_name
            }))
            sectionCallback(sectionPopular)
        })

        // 4. Récupération "New Series"
        const newReq = App.createRequest({
            url: `${API_BASE}/manga/list?limit=10&page=1&sort=created_at`,
            method: 'GET'
        })
        this.requestManager.schedule(newReq, 1).then(res => {
            const data = JSON.parse(res.data ?? '{}')
            sectionNew.items = (data.manga ?? []).map((m: any) => App.createPartialSourceManga({
                mangaId: m.id,
                image: m.cover_url,
                title: m.series_name
            }))
            sectionCallback(sectionNew)
        })

        // 5. Récupération "Latest Updates"
        const updatesReq = App.createRequest({
            url: `${API_BASE}/manga/recent?limit=10&page=1`,
            method: 'GET'
        })
        this.requestManager.schedule(updatesReq, 1).then(res => {
            const data = JSON.parse(res.data ?? '{}')
            sectionUpdates.items = (data.manga ?? []).map((m: any) => App.createPartialSourceManga({
                mangaId: m.id,
                image: m.cover_url,
                title: m.series_name
            }))
            sectionCallback(sectionUpdates)
        })
    }
}