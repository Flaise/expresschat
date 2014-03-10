var settings = {}
try {
    settings = require('./local-settings.js')
}
catch(err) {
    if(err.code !== 'MODULE_NOT_FOUND')
        throw err
}
settings.__proto__ = require('./default-settings.js')

module.exports = settings
