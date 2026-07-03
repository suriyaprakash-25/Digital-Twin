import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, type = 'website', image = '/og-image.jpg' }) => {
  const siteTitle = 'DrivePortz - Smart Vehicle Digital Twin';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const defaultDesc = 'Manage your vehicles, track service history, get predictive maintenance alerts, and book top garages instantly with DrivePortz.';
  const finalDescription = description || defaultDesc;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={finalDescription} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={finalDescription} />
      <meta property="twitter:image" content={image} />
    </Helmet>
  );
};

export default SEO;
