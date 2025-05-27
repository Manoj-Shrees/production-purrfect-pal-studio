
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "redirectTo": "/Home",
    "route": "/"
  },
  {
    "renderMode": 2,
    "route": "/Home"
  },
  {
    "renderMode": 2,
    "route": "/ProductPage"
  },
  {
    "renderMode": 2,
    "route": "/Login"
  },
  {
    "renderMode": 2,
    "route": "/Signup"
  },
  {
    "renderMode": 2,
    "route": "/OrderTracking"
  },
  {
    "renderMode": 2,
    "route": "/Payment"
  },
  {
    "renderMode": 2,
    "route": "/Mycart"
  },
  {
    "renderMode": 2,
    "route": "/Shop"
  },
  {
    "renderMode": 2,
    "route": "/FaqPage"
  },
  {
    "renderMode": 2,
    "route": "/PrivacyPolicy"
  },
  {
    "renderMode": 2,
    "route": "/OrderComplete"
  },
  {
    "renderMode": 2,
    "route": "/OrderPage"
  },
  {
    "renderMode": 2,
    "route": "/Profile"
  },
  {
    "renderMode": 2,
    "route": "/ForgotPassword"
  },
  {
    "renderMode": 2,
    "route": "/ForgotPasswordTimer"
  },
  {
    "renderMode": 2,
    "route": "/ForgotPasswordReset"
  },
  {
    "renderMode": 2,
    "route": "/AccountActivate"
  },
  {
    "renderMode": 2,
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 30050, hash: '249f636c9ba8842b19b2bc8e26aa482330d239506898fcc7fbf63c451fabf04f', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 18305, hash: 'c3ea3ffe6c1d7c5198bc884baffadd9694b87cc04d204e7567e9ddcbfa2399ea', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'Login/index.html': {size: 37558, hash: '1070fe7d5eb5cb75cfcb8dced1bfdcf7afcbac269cfd1d0b5ce8bc7b38ac3c01', text: () => import('./assets-chunks/Login_index_html.mjs').then(m => m.default)},
    'Signup/index.html': {size: 82129, hash: '8b3b52c5a5f1483abb761612f9b60bfd52b0f6367d2374cdc619abffb134c982', text: () => import('./assets-chunks/Signup_index_html.mjs').then(m => m.default)},
    'ProductPage/index.html': {size: 77931, hash: '7eeca67b8e0b69aac9595f8d44db76697467cb7575144d8c630a9cca25aae3f5', text: () => import('./assets-chunks/ProductPage_index_html.mjs').then(m => m.default)},
    'Home/index.html': {size: 58983, hash: '1dee07d129f3ece0e193378a90e8831cc88a76f8bd7cdea44998302bc50b990b', text: () => import('./assets-chunks/Home_index_html.mjs').then(m => m.default)},
    'OrderTracking/index.html': {size: 58983, hash: '2e1799ca3c2a0a656fd496fd06cd606c575531fddb072196d35e748bd47acec7', text: () => import('./assets-chunks/OrderTracking_index_html.mjs').then(m => m.default)},
    'Payment/index.html': {size: 58987, hash: 'b611960b1cb52fd72fa4e6fe450e3159b076d4c410deed2eedf368a7f7cdf7d9', text: () => import('./assets-chunks/Payment_index_html.mjs').then(m => m.default)},
    'FaqPage/index.html': {size: 63579, hash: '124f722d930f0896d7989fb730badda769e52b4a48bdb345b8f8ed952fe024e1', text: () => import('./assets-chunks/FaqPage_index_html.mjs').then(m => m.default)},
    'PrivacyPolicy/index.html': {size: 57817, hash: 'b0106edf5348d7b33852e27c31d25d4ab715e12ed3e011a27411c8aa070c07a1', text: () => import('./assets-chunks/PrivacyPolicy_index_html.mjs').then(m => m.default)},
    'Mycart/index.html': {size: 37563, hash: 'dd8aa3a770009dfcb89b53c1d236d71a92a6e59bee9befbfa480b20e77c1bf73', text: () => import('./assets-chunks/Mycart_index_html.mjs').then(m => m.default)},
    'Shop/index.html': {size: 37558, hash: '0e498a38b2bc2e1b590dad7be057c2b84e7f6ce57b3e75577c6e4996ccd58ff1', text: () => import('./assets-chunks/Shop_index_html.mjs').then(m => m.default)},
    'OrderComplete/index.html': {size: 37558, hash: '1070fe7d5eb5cb75cfcb8dced1bfdcf7afcbac269cfd1d0b5ce8bc7b38ac3c01', text: () => import('./assets-chunks/OrderComplete_index_html.mjs').then(m => m.default)},
    'OrderPage/index.html': {size: 37563, hash: 'b08b88b5ce56d1c2f78c805bf60a87698a7c85d7e2f6a71a4b0b89b2d35782a7', text: () => import('./assets-chunks/OrderPage_index_html.mjs').then(m => m.default)},
    'ForgotPasswordTimer/index.html': {size: 36691, hash: 'c1ded0318fbbf6b5888a87b2fdcdbafc9bb2e345a3d19b217802d35c40392d76', text: () => import('./assets-chunks/ForgotPasswordTimer_index_html.mjs').then(m => m.default)},
    'ForgotPassword/index.html': {size: 38511, hash: '43c0d2ce2e499b7c24e25b4458e48fddc852290cbf1df59f5bcfe9a0954b2855', text: () => import('./assets-chunks/ForgotPassword_index_html.mjs').then(m => m.default)},
    'ForgotPasswordReset/index.html': {size: 38676, hash: '915061aa9335de314bf9627385181b9ec9e3f68df6561ee70cc83836419958cd', text: () => import('./assets-chunks/ForgotPasswordReset_index_html.mjs').then(m => m.default)},
    'Profile/index.html': {size: 37563, hash: 'dd8aa3a770009dfcb89b53c1d236d71a92a6e59bee9befbfa480b20e77c1bf73', text: () => import('./assets-chunks/Profile_index_html.mjs').then(m => m.default)},
    'AccountActivate/index.html': {size: 58983, hash: '2e1799ca3c2a0a656fd496fd06cd606c575531fddb072196d35e748bd47acec7', text: () => import('./assets-chunks/AccountActivate_index_html.mjs').then(m => m.default)},
    'styles-UVGE5T37.css': {size: 343154, hash: 'NDkOh63Mjc0', text: () => import('./assets-chunks/styles-UVGE5T37_css.mjs').then(m => m.default)}
  },
};
