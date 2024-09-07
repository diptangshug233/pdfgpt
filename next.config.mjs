/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Redirects for the app.
   *
   * This function returns an array of redirect objects that define the mapping
   * from the source URL to the destination URL. The `permanent` property is
   * optional and defaults to `false`.
   *
   * @returns {import('next').NextRedirect[]}
   */
  async redirects() {
    return [
      {
        source: "/sign-in",
        destination: "/api/auth/login",
        permanent: true,
      },
      {
        source: "/sign-up",
        destination: "/api/auth/register",
        permanent: true,
      },
    ];
  },

  /**
   * Customizes the webpack configuration.
   *
   * @param {Object} config The current webpack configuration.
   * @param {string} buildId The build ID.
   * @param {boolean} dev Whether the build is in development mode.
   * @param {boolean} isServer Whether the build is for the server.
   * @param {Object} defaultLoaders The default webpack loaders.
   * @param {Object} webpack The webpack module.
   * @returns {Object} The modified webpack configuration.
   */
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gravatar.com",
        port: "",
        pathname: "/avatar/**",
      },
    ],
  },
};

export default nextConfig;
