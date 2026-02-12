module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: 10000000, // 10MB
        basePath: 'public/uploads'
      }
    }
  }
});
