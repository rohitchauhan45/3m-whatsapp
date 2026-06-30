export const calculateDistance = (lat1: number, long1: number, lat2: number, long2: number) => {
    const R = 6371000

    const dLat = (lat1 - lat2) * Math.PI / 180
    const dLong = (long1 - long2) * Math.PI / 180

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLong / 2) * Math.sin(dLong / 2)

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}