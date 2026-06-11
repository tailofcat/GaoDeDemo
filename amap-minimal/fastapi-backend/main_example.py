"""
FastAPI 项目集成示例

展示如何在 FastAPI 项目中集成高德地图反向代理和配置管理
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from amap_proxy import router as amap_router


class Settings(BaseSettings):
    """应用配置"""
    # 高德地图配置
    amap_key: str = ""                    # JS API Key（前端使用）
    amap_security_key: str = ""           # 安全密钥（后端代理使用）

    # 应用配置
    app_name: str = "My FastAPI App"
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# 创建设置实例
settings = Settings()

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

# CORS 配置（允许前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载高德地图反向代理路由
app.include_router(amap_router, prefix="/_AMapService")


@app.get("/")
async def root():
    """根路径"""
    return {"message": "Welcome to FastAPI", "app_name": settings.app_name}


@app.get("/api/config/amap")
async def get_amap_config():
    """
    获取高德地图配置（供前端使用）
    注意：不要返回 security_key
    """
    return {
        "apiKey": settings.amap_key,
        "securityHost": "/_AMapService"  # 代理路径
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
