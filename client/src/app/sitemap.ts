
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: 'https://flashchecker.in',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        // Add other routes if you have them (e.g. /about, /verify)
    ];
}
