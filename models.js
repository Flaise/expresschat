
var crypto = require('crypto')
var mongoose = require('mongoose')
var passwordHash = require('password-hash')


var userAccountSchema = mongoose.Schema({
    name: {type:String, required:true},
    hashedPassword: String,
    email: String,
    joinDate: {type:Date, default:Date.now, required:true},
    hashedAuthToken: String
})
userAccountSchema.methods.isPassword = function(password) {
    return passwordHash.verify(password, this.hashedPassword)
}
userAccountSchema.methods.setPassword = function(cleartext) {
    this.hashedPassword = passwordHash.generate(cleartext)
}
userAccountSchema.methods.isAuthToken = function(token) {
    return passwordHash.verify(token, this.hashedAuthToken)
}
userAccountSchema.methods.genAuthToken = function(cb) {
    try {
        var token = crypto.randomBytes(256).toString('base64')
    }
    catch(err) {
        console.warn(err.stack || err)
        // If the entropy buffer isn't full, just generate some data anyway.
        // This is itself going to be a fairly random occurrence so the security impact should be minimal.
        token = crypto.pseudoRandomBytes(256).toString('base64')
    }
    this.hashedAuthToken = passwordHash.generate(token)
    cb(null, token)
}

var UserAccount = mongoose.model('UserAccount', userAccountSchema)

module.exports = {
    UserAccount: UserAccount
}
