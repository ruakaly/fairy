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

const DOMAIN = 'https://athreascans.com'

export const AthreaScansInfo: SourceInfo = {
    version: '1.0.0',
    name: 'AthreaScans',
    icon: 'icon.png',
    author: 'nadi 𑣲',
    authorWebsite: 'https://github.com/ruakaly',
    description: 'Extension Paperback pour Athrea Scans',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class AthreaScans extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        // Ajoute ce bloc ci-dessous :
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${DOMAIN}/`,
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        const title = $('.entry-title').text().trim()
        const image = $('.thumb img').attr('src') ?? ''
        const description = $('.entry-content p').text().trim()
        
        let status = 'Ongoing'
        const statusText = $('.imptdt:contains("Status") i').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                desc: description,
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        const chapters: Chapter[] = []
        const chapterNodes = $('#chapterlist li')

        for (const node of chapterNodes) {
            const link = $(node).find('a')
            const title = $(node).find('.chapternum').text().trim() || link.text().trim()
            const href = link.attr('href')
            const id = href ? href.replace(DOMAIN, '') : ''

            if (!id) continue

            const chapNum = Number(title.match(/(\d+(\.\d+)?)/)?.[0] ?? 0)
            const timeStr = $(node).find('.chapterdate').text().trim()
            const time = new Date(timeStr)

            chapters.push(App.createChapter({
                id: id,
                chapNum: chapNum,
                name: title,
                langCode: 'en',
                time: isNaN(time.getTime()) ? new Date() : time
            }))
        }
        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${DOMAIN}${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        const pages: string[] = []
        const images = $('#readerarea img').toArray()

        for (const img of images) {
            const $img = $(img)
            // Gestion du Lazy Loading
            let url = $img.attr('data-src') || $img.attr('src') || $img.attr('data-lazy-src')
            url = url?.trim()

            if (url && !url.startsWith('data:image')) {
                pages.push(url)
            }
        }

        // Secours si les images sont dans un script JSON
        if (pages.length === 0) {
            const scripts = $('script').toArray()
            for (const script of scripts) {
                const content = $(script).html()
                if (content?.includes('ts_reader.run')) {
                    const match = content.match(/"images"\s*:\s*(\[[^\]]+\])/)
                    if (match?.[1]) {
                        const parsedImages = JSON.parse(match[1])
                        pages.push(...parsedImages)
                    }
                }
            }
        }

        const data: any = {
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            headers: {
                'referer': `${DOMAIN}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }
        return App.createChapterDetails(data)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(query.title ?? '')}`
        const request = App.createRequest({ url: searchUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')
        const tiles: any[] = []

        for (const item of $('.listupd .bsx').toArray()) {
            const link = $(item).find('a')
            const id = link.attr('href')?.split('/manga/')[1]?.replace(/\/$/, '')
            const title = link.attr('title')
            const image = $(item).find('img').attr('src') ?? ''

            if (id && title) {
                tiles.push(App.createPartialSourceManga({ mangaId: id, image: image, title: title, subtitle: undefined }))
            }
        }

        return App.createPagedResults({ results: tiles })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Ajout de 'containsMoreItems' pour corriger les erreurs de compilation
        const sectionFeatured = App.createHomeSection({ 
            id: 'featured', 
            title: 'Featured', 
            type: 'singleRowLarge',
            containsMoreItems: false 
        })
        const sectionLatest = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates', 
            type: 'singleRowNormal',
            containsMoreItems: true 
        })
        const sectionNew = App.createHomeSection({ 
            id: 'new', 
            title: 'New Series', 
            type: 'singleRowNormal',
            containsMoreItems: false 
        })

        sectionCallback(sectionFeatured)
        sectionCallback(sectionLatest)
        sectionCallback(sectionNew)

        const request = App.createRequest({ url: DOMAIN, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        // Featured (Slider)
        const featuredItems: any[] = []
        for (const item of $('.slidernom3 .swiper-slide').toArray()) {
            const link = $(item).find('a')
            const id = link.attr('href')?.split('/manga/')[1]?.replace(/\/$/, '')
            const title = $(item).find('.name').text().trim()
            const image = $(item).find('img').attr('src') ?? ''
            if (id && title) featuredItems.push(App.createPartialSourceManga({ mangaId: id, title, image, subtitle: undefined }))
        }
        sectionFeatured.items = featuredItems
        sectionCallback(sectionFeatured)

        // Latest Updates
        const latestItems: any[] = []
        for (const item of $('.postbody .listupd .bsx').toArray()) {
            const id = $(item).find('a').attr('href')?.split('/manga/')[1]?.replace(/\/$/, '')
            const title = $(item).find('a').attr('title')
            const image = $(item).find('img').attr('src') ?? ''
            if (id && title) latestItems.push(App.createPartialSourceManga({ mangaId: id, title, image, subtitle: undefined }))
        }
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)

        // New Series (Sidebar)
        const newItems: any[] = []
        for (const item of $('#sidebar .serieslist ul li').toArray()) {
            const link = $(item).find('a.series')
            const id = link.attr('href')?.split('/manga/')[1]?.replace(/\/$/, '')
            const title = link.text().trim() || link.find('img').attr('title') || ''
            const image = $(item).find('img').attr('src') ?? ''
            if (id && title) newItems.push(App.createPartialSourceManga({ mangaId: id, title, image, subtitle: undefined }))
        }
        sectionNew.items = newItems
        sectionCallback(sectionNew)
    }
}