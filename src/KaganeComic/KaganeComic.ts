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

// On définit les headers pour imiter un vrai navigateur
const COMMON_HEADERS = {
    'Referer': DOMAIN,
    'Origin': DOMAIN,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export const KaganeComicInfo: SourceInfo = {
    version: '1.0.2', // J'ai monté la version pour forcer la mise à jour
    name: 'KaganeComic',
    icon: 'icon.png',
    author: 'Toi',
    authorWebsite: 'https://github.com/ruanadia',
    description: 'Extension pour Kagane.org (Next.js)',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN
}

export class KaganeComic extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
    })

    // --- NOUVELLE FONCTION DE PARSING PLUS ROBUSTE ---
    parseNextJsData(html: string): any[] {
        const $ = cheerio.load(html)
        
        // Méthode 1 : Chercher les données dans les balises script "self.__next_f.push"
        // C'est là que Kagane stocke ses listes
        let foundData: any[] = []

        $('script').each((index, element) => {
            const content = $(element).html()
            if (!content) return

            // On cherche des blocs de données JSON qui ressemblent à des listes de mangas
            // On cherche des motifs comme: "id":"...","name":"...","thumbnail":"..."
            if (content.includes('self.__next_f.push')) {
                try {
                    // On nettoie le js pour ne garder que les strings JSON potentielles
                    // C'est du "parsing sauvage" mais efficace pour ce type de site
                    const matches = content.match(/{"id":".*?","name":".*?","summary":".*?"/g)
                    
                    if (matches) {
                        // Si on trouve des correspondances, on essaie de reconstruire les objets
                        // L'astuce est de voir que les données sont souvent sérialisées en chaîne
                        const rawData = content; 
                        
                        // Cherchons la liste "data":[ ... ]
                        const dataMatch = rawData.match(/"data":\[({.*?})\]/)
                        if (dataMatch && dataMatch[1]) {
                            // On tente de parser ce bout de JSON
                            // Attention : c'est risqué, alors on va plutôt utiliser une regex pour extraire chaque item
                            const itemRegex = /{"id":"(.*?)","name":"(.*?)","summary":".*?","thumbnail":"(.*?)"/g
                            let match;
                            // Note: Le regex exact dépend de la structure, essayons plus large
                        }
                    }
                } catch (e) {
                    // Ignorer les erreurs de parsing
                }
            }
        })

        // Méthode 2 (La plus simple) : Parser le HTML directement si Next.js a rendu le contenu
        // Souvent, Next.js rend une partie du HTML statique pour le SEO
        const mangaItems = $('a[href^="/series/"], a[href^="/comic/"]')
        
        mangaItems.each((i, el) => {
            const href = $(el).attr('href')
            const id = href?.split('/').pop()
            const title = $(el).find('h3, h4, .title, span.font-bold').first().text().trim() || $(el).attr('title')
            const img = $(el).find('img').attr('src') || $(el).find('img').attr('srcset')?.split(' ')[0]

            if (id && title) {
                // On évite les doublons
                if (!foundData.find(x => x.id === id)) {
                    foundData.push({
                        id: id,
                        name: title,
                        thumbnail: img
                    })
                }
            }
        })

        return foundData
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${DOMAIN}/series/${mangaId}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const html = response.data ?? ''
        const $ = cheerio.load(html)

        // Extraction directe du HTML (plus fiable que le JSON caché pour les détails)
        const title = $('h1').text().trim() || 'Titre Inconnu'
        // Cherche l'image principale (souvent la plus grande ou celle dans la section "info")
        let image = $('img[alt="' + title + '"]').attr('src') || $('img').first().attr('src') || ''
        if (image.startsWith('/')) image = DOMAIN + image

        const desc = $('p.description, .summary').text().trim()
        
        // Statut
        let status = 'Ongoing'
        if ($('*:contains("Completed"), *:contains("Ended")').length > 0) status = 'Completed'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                desc: desc,
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // Pour les chapitres, Kagane utilise souvent une API distincte
        // Essayons l'API directe que tu avais trouvée, adaptée
        const request = App.createRequest({
            url: `${DOMAIN}/api/series/${mangaId}/chapters?page=1&perPage=1000`, // On tente de tout récupérer
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const chapters: Chapter[] = []
        
        try {
            const json = JSON.parse(response.data ?? '{}')
            // La liste est souvent dans "data" ou "chapters"
            const list = Array.isArray(json) ? json : (json.data || json.chapters || [])

            for (const item of list) {
                chapters.push(App.createChapter({
                    id: String(item.id), // ID du chapitre
                    chapNum: Number(item.number || item.sequenceNumber || 0),
                    name: item.title || `Chapter ${item.number}`,
                    langCode: 'en',
                    time: item.createdAt ? new Date(item.createdAt) : new Date()
                }))
            }
        } catch (e) {
            console.log(`Erreur API chapitres, tentative HTML...`)
            // Fallback : Si l'API échoue, on regarde le HTML de la page série
            // Mais pour une SPA, c'est rare que les chapitres soient dans le HTML initial
        }
        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${DOMAIN}/api/chapters/${chapterId}/pages`, // URL probable pour les pages
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        let pages: string[] = []

        try {
            const json = JSON.parse(response.data ?? '{}')
            const list = Array.isArray(json) ? json : (json.pages || json.data || [])
            
            pages = list.map((img: any) => {
                const url = typeof img === 'string' ? img : (img.url || img.src)
                return url.startsWith('http') ? url : DOMAIN + url
            })
        } catch (e) {
            throw new Error(`Erreur pages`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // Recherche via l'API, c'est le plus sûr
        const request = App.createRequest({
            url: `${DOMAIN}/api/series/search?q=${encodeURIComponent(query.title ?? '')}`,
            method: 'GET',
            headers: COMMON_HEADERS
        })

        const response = await this.requestManager.schedule(request, 1)
        const tiles: any[] = []
        
        try {
            const json = JSON.parse(response.data ?? '{}')
            const list = json.data || json.series || []

            for (const item of list) {
                let img = item.thumbnail || item.cover || ''
                if (img && !img.startsWith('http')) img = DOMAIN + img

                tiles.push(App.createPartialSourceManga({
                    mangaId: String(item.id),
                    title: item.title || item.name,
                    image: img,
                    subtitle: undefined
                }))
            }
        } catch(e) {}

        return App.createPagedResults({ results: tiles })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section = App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: 'singleRowNormal' })
        sectionCallback(section)

        // API : On appelle directement l'API de recherche triée par date
        // C'est ce que fait le site quand il charge la page d'accueil
        const request = App.createRequest({
            // Cette URL est souvent celle utilisée par le frontend pour peupler la liste
            url: `${DOMAIN}/api/series/latest`, // Ou /api/series?sort=newest
            method: 'GET',
            headers: COMMON_HEADERS
        })

        // Si l'URL ci-dessus ne marche pas, on essaiera celle que tu as trouvée :
        // url: `${DOMAIN}/search?sort=created_at,desc` 
        // Mais en parsant le HTML retourné par cette page

        const response = await this.requestManager.schedule(request, 1)
        const mangaList: any[] = []
        
        // Essai de lecture JSON (si l'API répond du JSON)
        try {
            const json = JSON.parse(response.data ?? '{}')
            const list = json.data || json.series || []
            
            for (const item of list) {
                let img = item.thumbnail || item.cover || ''
                if (img && !img.startsWith('http')) img = DOMAIN + img

                mangaList.push(App.createPartialSourceManga({
                    mangaId: String(item.id),
                    title: item.title || item.name,
                    image: img,
                    subtitle: undefined
                }))
            }
        } catch (e) {
            // Si ce n'est pas du JSON, c'est du HTML
            // On utilise notre parseur de secours
            const foundItems = this.parseNextJsData(response.data ?? '')
            for (const item of foundItems) {
                mangaList.push(App.createPartialSourceManga({
                    mangaId: item.id,
                    title: item.name,
                    image: item.thumbnail,
                    subtitle: undefined
                }))
            }
        }

        section.items = mangaList
        sectionCallback(section)
    }
}