export const className = 'GalleriesFinderLS'

export class GalleriesFinderLS {
  constructor({ params, config, utils, api }) {
    const galleryFolder = config?.path?.names?.[params?.galleryFolderName] ?? 'gallery'
    const thumbsFolder = config?.path?.names?.thumbs ?? 'thumbs'

    const basePaths = typeof config.path.galleries === 'string' ? [config.path.galleries] : config.path.galleries

    const resolveGalleryPaths = config.api?.endpoints?.resolve?.galleryPaths?.enabled ?? true

    const hasItem = async (folderPath, itemName) => {

      const resolved = resolveGalleryPaths ? await api.resolvePath(folderPath) : folderPath

      for await (const item of api.listFolder('ls', resolved, 1, 'folders')) {
        if (item === itemName) {
          return true
        }
      }
      return false
    }

    const hasThumbs = (folderPath) => hasItem(folderPath, thumbsFolder)

    const hasGallery = (folderPath) => hasItem(folderPath, galleryFolder)

    const filterGalleries = async function* (bPath) {

      const resolved = resolveGalleryPaths ? await api.resolvePath(bPath) : bPath

      for await (const folderItem of api.listFolder('ls', resolved, 1, 'folders')) {
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
            utils.addGallery(config, gallery, { preview: params.preview, galleriespath: bPath })
            existing.add(gallery)
          }
        }
      }
    }
  }
}
