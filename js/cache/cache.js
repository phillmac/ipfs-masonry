export class Cache {
  constructor() {
    if ((!localStorage.cacheVersion) && (localStorage.folders || localStorage.files)) {
      localStorage.cacheVersion = '0.1.0'
    } else if (!localStorage.cacheVersion) {
      localStorage.cacheVersion = '0.2.0'
    }

    this.jsonParseOrDefault = (str, defaultVal) => {
      try {
        result = JSON.parse(LZString.decompress(str));
        if (!result) {
          return defaultVal;
        }
        return result
      } catch (e) {
        return defaultVal;
      }
    }

    this.getWithExpiry = (key, path) => {
      const itemStr = localStorage.getItem(key)
      // if the item doesn't exist, return null
      if (!itemStr) {
        return null
      }
      const keyItem = this.jsonParseOrDefault(itemStr, {})
      if (!keyItem) {
        return null
      }
      const item = keyItem[path]
      if (!item) {
        return null
      }
      const now = new Date()
      // compare the expiry time of the item with the current time
      if (now.getTime() > item.expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        delete keyItem[path]
        localStorage.setItem(key, JSON.stringify(keyItem))
        return null
      }
      return item.value
    }

    this.setWithExpiry = (key, path, value, ttl) => {
      const now = new Date()

      // `item` is an object which contains the original value
      // as well as the time when it's supposed to expire
      const item = {
        value: value,
        expiry: now.getTime() + ttl,
      }
      const keyItem = this.jsonParseOrDefault(localStorage.getItem(key), {})
      keyItem[path] = item
      localStorage.setItem(key, LZString.compress(JSON.stringify(keyItem)))
    }
  }
}