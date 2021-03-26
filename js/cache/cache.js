export class localStoreCache {
  constructor() {
    if ((!localStorage.cacheVersion) && (localStorage.folders || localStorage.files)) {
      localStorage.cacheVersion = '0.1.0'
    } else if (!localStorage.cacheVersion) {
      localStorage.cacheVersion = '0.2.0'
    }

    const jsonParseOrDefault = (str, defaultVal) => {
      try {
        const result = JSON.parse(LZString.decompress(str))
        if (!result) {
          return defaultVal
        }
        return result
      } catch (e) {
        return defaultVal
      }
    }

    this.getWithExpiry = async (key, path) => {
      const itemStr = localStorage.getItem(key)
      // if the item doesn't exist, return null
      if (!itemStr) {
        return null
      }
      const keyItem = jsonParseOrDefault(itemStr, {})
      if (!keyItem) {
        return null
      }
      const item = keyItem[path]
      if (!item) {
        return null
      }
      const now = new Date().getTime()
      const expiry = item.expiry
      // compare the expiry time of the item with the current time
      if (now > expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        console.debug({ path, now, expiry })
        delete keyItem[path]
        localStorage.setItem(key, JSON.stringify(keyItem))
        return null
      }
      return item.value
    }

    this.setWithExpiry = async (key, path, value, ttl) => {
      const now = new Date()

      // `item` is an object which contains the original value
      // as well as the time when it's supposed to expire
      const expiry = now.getTime() + ttl * 1000 + Math.floor(Math.random() * ttl * 1000)
      const item = {
        value,
        expiry
      }
      console.debug({ path, expiry })
      const keyItem = jsonParseOrDefault(localStorage.getItem(key), {})
      keyItem[path] = item
      localStorage.setItem(key, LZString.compress(JSON.stringify(keyItem)))
    }
  }
}

export class indexedDBCache {
  constructor({ openDB }) {
    const dbPromise = openDB('cache-db', 1, {
      upgrade(db) {
        db.createObjectStore('cache')
      }
    })

    this.getWithExpiry = async (key, path) => {
      const item = (await dbPromise).get(key, path)

      if (!item) {
        return null
      }
      const now = new Date().getTime()
      const expiry = item.expiry
      // compare the expiry time of the item with the current time
      if (now > expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        console.debug({ path, now, expiry })
        delete (await dbPromise).delete(key, path)
        return null
      }
      return item.value
    }

    this.setWithExpiry = async (key, path, value, ttl) => {
      const now = new Date()

      // `item` is an object which contains the original value
      // as well as the time when it's supposed to expire
      const expiry = now.getTime() + ttl * 1000 + Math.floor(Math.random() * ttl * 1000)
      const item = {
        value,
        expiry
      }
      console.debug({ path, expiry })
      await (await dbPromise).put(key, item, path)
    }
  }
}
