import multer from "multer";

export const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const allowfilesType = [
            "image/jpeg",
            "image/jpg",
            "image/png"
        ]

        if (!allowfilesType.includes(file.mimetype)) {
            return cb(new Error("Only photo are allowed"))
        }

        cb(null, true)
    }  
})