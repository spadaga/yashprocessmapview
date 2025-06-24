/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    webpack(config) {
      config.module.rules.push({
        test: /\.xml$/,
        use: 'raw-loader',
      });
      return config;
    },
  };
  
  export default nextConfig;
  