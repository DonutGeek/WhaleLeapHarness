// 统一的 HTTP 请求模块：整个项目发网络请求都走这里导出的 request，
// 不要页面里各自 import axios——统一出口才能集中管 baseURL、超时、鉴权头、错误提示
import axios from 'axios'

// axios.create 创建一个独立的"实例"：全局默认值（ baseURL、超时…）都设在这里，
// 和业务代码解耦，以后换域名/改超时只动这一个文件
export const request = axios.create({
  // 接口前缀：实际发请求时写 request.get("/user") 就等于请求 "/api/user"。
  // 这个值来自 .env.development / .env.production 里的 VITE_GLOB_API_URL
  // （Vite 在编译时把 import.meta.env.VITE_GLOB_API_URL 直接替换成字符串字面量）。
  // 本地开发时这个前缀通常由 vite 的 server.proxy 转发到真实后端（还没配，先占位）
  baseURL: import.meta.env.VITE_GLOB_API_URL,
  // 超时时间（毫秒）：超过 10 秒没响应就报错，避免请求一直挂着
  timeout: 10000
})

// 请求拦截器：每次发请求"之前"统一做的事
request.interceptors.request.use((config) => {
  // 典型用法：给每个请求带上登录令牌
  // const token = localStorage.getItem("token");
  // if (token) config.headers.Authorization = `Bearer ${token}`;
  return config
})

// 响应拦截器：收到响应"之后"统一做的事
request.interceptors.response.use(
  // 成功时直接返回数据本体（axios 默认返回的 response 对象里除了 data
  // 还有 status、headers 等一堆业务用不上的东西，这里剥掉，页面拿到就能用）
  (response) => response.data,
  // 失败时（网络错误、4xx、5xx）先经过这里，以后可以统一弹错误提示，
  // 现在原样抛回，由调用的页面自己决定怎么处理
  (error) => Promise.reject(error)
)
