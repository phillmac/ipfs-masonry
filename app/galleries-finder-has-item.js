const itemType = 1

export const className = 'GalleriesFinderHasItem'

export class GalleriesFinderHasItem {
  constructor({ params, config, api }) {
    const galleryFolder = config?.path?.names?.[params.galleryFolderName] ?? 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs ?? 'thumbs'

    const basePaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries

    const hasThumbs = (folderPath) => api.hasItem(folderPath, thumbsFolder, 1)

    const hasGallery = (folderPath) => api.hasItem(folderPath, galleryFolder, 1)

    const filterGalleries = async function* (bPath) {

      for await (const folderItem of api.listFolder('ls', bPath, 1, 'folders')) {
        if (
          await hasGallery(`${bPath}/${folderItem}`, galleryFolder)
        ) {
          if ((await hasThumbs(`${bPath}/${folderItem}/${galleryFolder}`)) || params.preview) {
            yield folderItem
          }
        }
      }
    }

    this.start = async () => {
      const existing = new Set()

      for (const bPath of basePaths) {
        for await (const gallery of filterGalleries(bPath)) {
          if (!existing.has(gallery)) {
            addGallery(gallery, { preview: params.preview, galleriespath: galPath })
            existing.add(gallery)
          }
        }
      }
    }
  }
}