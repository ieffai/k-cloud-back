const fileService = require('../services/fileService');
const config = require('config');
const fs = require('fs');
const User = require('../models/User');
const File = require('../models/File');
const Uuid = require('uuid');

class FileController {
    async createDir(req, res) {
        try {

            const {name, type, parent} = req.body;
            const file = new File({ name, type, parent, user: req.user.id });
            const parentFile = await File.findOne({_id: parent });
            if(!parentFile) {
                file.path = name;
                await fileService.createDir(req, file);
            } else {
                file.path = `${parentFile.path}\\${file.name}`;
                await fileService.createDir(req, file);
                parentFile.childs.push(file._id);
                await parentFile.save();
            }
            await file.save();
            return res.json(file);
        } catch (error) {
            console.log(error);
            return res.status(400).json(error)
        }
    }

    async getFiles(req, res) {
        try {
            const {sort} = req.query;

            const files = await File.find({ user: req.user.id, parent: req.query.parent }).sort({[sort] : 1});
             switch (sort) {
                case 'name': 
                    return res.json(files);
                case 'type': 
                    return res.json(files);
                case 'date': 
                    return res.json(files);
                default: 
                    return res.json(files);
            }
        } catch (error) {
            console.log(error);
            return res.status(500).json({message: 'Can not get files'})
        }
    }

    async uploadFile(req, res) {
        try {
            const file = req.files.file;
            const parent = await File.findOne({user: req.user.id, _id: req.body.parent});
            const user = await User.findOne({_id: req.user.id});
            if (user.usedSpace + file.size > user.diskSpace) {
                return res.status(400).json({message: 'There is not enough space'});
            }
            user.usedSpace = user.usedSpace + file.size;
            let path;
            if(parent) {
                path = `${req.filePath}\\${user._id}\\${parent.path}\\${file.name}`;
            } else {
                path = `${req.filePath}\\${user._id}\\${file.name}`;
            }

            if (fs.existsSync(path)) {
                return res.status(400).json({message: 'File already exists'})
            }
            file.mv(path);
            console.log('path in uploadFile is '+path)
            const type = file.name.split('.').pop();
            let filePath = file.name;
            if(parent) {
                filePath = parent.path + "\\" + file.name;
            }
            const dbFile = new File({
                name: file.name,
                type,
                size: file.size,
                path: filePath,
                parent: parent ? parent._id : null,
                user: user._id
            })

            await dbFile.save();
            await user.save();
            res.json(dbFile);
     
        } catch (error) {
            console.log(error);
            return res.status(500).json({message: 'Upload error'})
        }
    }
    async downloadFile(req, res) {
        try {
            const file = await File.findOne({_id: req.query.id, user: req.user.id});
            const path = fileService.getPath(req, file);
            console.log('path in download is '+path)
            if (fs.existsSync(path)) {
                return res.download(path, file.name);
            }
            return res.status(500).json({message: 'No such file or directory'})
        } catch (error) {
            console.log(error);
            return res.status(500).json({message: "Download error"})
        }
    }
    async deleteFile(req, res) {
        try {
            const file = await File.findOne({_id: req.query.id, user: req.user.id});
            const user = await User.findOne({_id: req.user.id});
            if(!file) {
                return res.status(400).json({message: 'File not found'})
            }
            user.usedSpace = user.usedSpace - file.size;
            fileService.deleteFile(req, file);
            await file.remove();
            await user.save();
            return res.json({message: 'File was deleted'});
        } catch (error) {
            console.log(error);
            res.status(400).json({message: 'Directory is not empty'});
        }
    }
    async searchFile(req, res) {
        try {
            const searchName = req.query.search;
            let files = await File.find({user: req.user.id});
            files = files.filter(file => file.name.includes(searchName));
            return res.json(files);
        } catch (error) {
            console.log(error);
            res.status(400).json({message: 'Search error'});
        }
    }
    async uploadAvatar(req, res) {
        try {
            const file = req.files.file;
            const user = await User.findById(req.user.id);
            const avatarName = Uuid.v4() + '.jpg';
            const path = `${req.filePath + '/' + req.user.id + '/' + avatarName}`;
            console.log('path in upload is '+path)
            file.mv(path);
            user.avatar = avatarName;
            await user.save();
            return res.json(user)
        } catch (error) {
            console.log(error);
            res.status(400).json({message: 'Avatar upload error'})
        }
    }
    async deleteAvatar(req, res) {
        try {
            const user = await User.findById(req.user.id);
            console.log(user);
            const path = `${req.filePath + '/' + req.user.id}`
            console.log('path in delete is '+path)
            fs.unlinkSync(path + '/' + user.avatar);
            
            user.avatar = null;
            await user.save();
            return res.json(user)
        } catch (error) {
            console.log(error);
            res.status(400).json({message: 'Avatar delete error'})
        }
    }
}

module.exports = new FileController();