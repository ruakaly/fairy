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

const DOMAIN = 'https://violetscans.org'

export const VioletScansInfo: SourceInfo = {
    version: '1.0.0',
    name: 'VioletScans',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruakaly',
    description: 'Extension Paperback pour VioletScans',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class VioletScans extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // VioletScans utilise /comics/ au lieu de /manga/
        const request = App.createRequest({
            url: `${DOMAIN}/comics/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        // Sélecteurs standards pour le thème Mangareader utilisé par VioletScans
        const title = $('.entry-title').text().trim()
        const image = $('.thumb img').attr('src') ?? ''
        const description = $('.entry-content p').text().trim()
        
        let status = 'Ongoing'
        // Recherche du statut dans les metadonnées (souvent dans .imptdt)
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
            url: `${DOMAIN}/comics/${mangaId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')

        const chapters: Chapter[] = []
        // Sélecteur de liste des chapitres
        const chapterNodes = $('#chapterlist li')

        for (const node of chapterNodes) {
            const link = $(node).find('a')
            const title = $(node).find('.chapternum').text().trim() || link.text().trim()
            const href = link.attr('href')
            
            // L'ID du chapitre est le chemin relatif (ex: /titre-chapter-1/)
            const id = href ? href.replace(DOMAIN, '') : ''

            if (!id) continue

            // Extraction du numéro de chapitre
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
        // Sélecteur pour les images du lecteur
        const images = $('#readerarea img')

        for (const img of images) {
            let url = $(img).attr('src')?.trim()
            if (url) pages.push(url)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // La recherche se fait via le paramètre 's'
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(query.title ?? '')}`
        
        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')
        const tiles: any[] = []

        // Sélecteur des résultats de recherche
        const foundItems = $('.listupd .bsx')

        for (const item of foundItems) {
            const link = $(item).find('a')
            const title = link.attr('title') ?? $(item).find('.tt').text().trim()
            const image = $(item).find('img').attr('src') ?? ''
            const href = link.attr('href')
            
            // Extraction de l'ID depuis l'URL (qui contient /comics/)
            const id = href?.split('/comics/')[1]?.replace(/\/$/, '')

            if (id && title) {
                tiles.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }

        return App.createPagedResults({
            results: tiles
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        
        // Définition des sections
        const sectionFeatured = App.createHomeSection({ id: 'featured', title: 'Featured', containsMoreItems: false, type: 'singleRowLarge' })
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popular Today', containsMoreItems: false, type: 'singleRowNormal' })
        const sectionNew = App.createHomeSection({ id: 'new_series', title: 'New Series', containsMoreItems: false, type: 'singleRowNormal' })
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })
        
        sectionCallback(sectionFeatured)
        sectionCallback(sectionPopular)
        sectionCallback(sectionNew)
        sectionCallback(sectionLatest)

        const request = App.createRequest({
            url: DOMAIN,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data ?? '')
        
        // --- 1. Featured (Slider) ---
        // Sélecteur : .slidernew .swiper-slide
        const featuredItems: any[] = []
        for (const item of $('.slidernew .swiper-slide').toArray()) {
            const link = $(item).find('a')
            const imgTag = $(item).find('img')
            
            const id = link.attr('href')?.split('/comics/')[1]?.replace(/\/$/, '')
            const image = imgTag.attr('src') ?? ''
            // Le titre est souvent dans l'attribut alt de l'image
            const title = imgTag.attr('alt') ?? ''
            
            if(id && title) {
                featuredItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }))
            }
        }
        sectionFeatured.items = featuredItems
        sectionCallback(sectionFeatured)

        // --- 2. Popular Today ---
        // Sélecteur : .hotslid .pop-list .bsx
        const popularItems: any[] = []
        for (const item of $('.hotslid .pop-list .bsx').toArray()) {
            const link = $(item).find('a')
            const id = link.attr('href')?.split('/comics/')[1]?.replace(/\/$/, '')
            const title = link.attr('title')
            const image = $(item).find('img').attr('src') ?? ''
            
            if(id && title) {
                popularItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }))
            }
        }
        sectionPopular.items = popularItems
        sectionCallback(sectionPopular)

        // --- 3. New Series ---
        // Sélecteur : .postbody .pop-list .bsx (La section postbody contient "New Series" puis une liste)
        const newItems: any[] = []
        // On cible spécifiquement la liste qui suit le titre "New Series" si possible, ou la première liste dans postbody
        for (const item of $('.postbody .pop-list .bsx').toArray()) {
            const link = $(item).find('a')
            const id = link.attr('href')?.split('/comics/')[1]?.replace(/\/$/, '')
            const title = link.attr('title')
            const image = $(item).find('img').attr('src') ?? ''
            
            if(id && title) {
                newItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }))
            }
        }
        sectionNew.items = newItems
        sectionCallback(sectionNew)

        // --- 4. Latest Update ---
        // Sélecteur : .latest-updates .bsx
        const latestItems: any[] = []
        for (const item of $('.latest-updates .bsx').toArray()) {
            const link = $(item).find('a')
            const id = link.attr('href')?.split('/comics/')[1]?.replace(/\/$/, '')
            const title = link.attr('title')
            const image = $(item).find('img').attr('src') ?? ''
            
            if(id && title) {
                latestItems.push(App.createPartialSourceManga({ mangaId: id, title: title, image: image, subtitle: undefined }))
            }
        }
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)
    }
}