"""
高德地图反向代理路由 - FastAPI 版本

将此文件集成到你的 FastAPI 项目中，用于代理高德地图 API 请求并附加安全密钥。

使用方法:
    from fastapi import FastAPI
    from amap_proxy import router as amap_router

    app = FastAPI()
    app.include_router(amap_router, prefix="/_AMapService")

环境变量:
    AMAP_SECURITY_KEY: 高德地图安全密钥 (jscode)
"""

import os
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response, PlainTextResponse
import httpx

router = APIRouter()

# 从环境变量获取安全密钥
AMAP_SECURITY_KEY = os.getenv("AMAP_SECURITY_KEY", "")

# 高德 API 基础 URL
WEBAPI_BASE = "https://webapi.amap.com"
RESTAPI_BASE = "https://restapi.amap.com"


async def proxy_request(
    request: Request,
    target_base: str,
    path: str = "",
    extra_params: Optional[dict] = None
) -> Response:
    """
    代理请求到高德 API

    Args:
        request: FastAPI 请求对象
        target_base: 目标 API 基础 URL
        path: 请求路径
        extra_params: 附加查询参数

    Returns:
        Response: 代理响应
    """
    if not AMAP_SECURITY_KEY:
        raise HTTPException(
            status_code=500,
            detail="AMAP_SECURITY_KEY not configured"
        )

    # 构建目标 URL
    target_url = f"{target_base}{path}"

    # 获取原始查询参数
    params = dict(request.query_params)

    # 添加额外参数（如 jscode）
    if extra_params:
        for key, value in extra_params.items():
            if key not in params:
                params[key] = value

    # 确保 jscode 存在
    if "jscode" not in params:
        params["jscode"] = AMAP_SECURITY_KEY

    # 获取请求头
    headers = {
        "User-Agent": request.headers.get("user-agent", ""),
        "Referer": request.headers.get("referer", ""),
    }

    try:
        async with httpx.AsyncClient() as client:
            # 根据请求方法转发
            method = request.method.upper()

            if method == "GET":
                response = await client.get(
                    target_url,
                    params=params,
                    headers=headers,
                    timeout=30.0
                )
            elif method == "POST":
                body = await request.body()
                response = await client.post(
                    target_url,
                    params=params,
                    headers=headers,
                    content=body,
                    timeout=30.0
                )
            else:
                # 其他方法
                response = await client.request(
                    method,
                    target_url,
                    params=params,
                    headers=headers,
                    timeout=30.0
                )

            # 返回响应
            content_type = response.headers.get("content-type", "application/json")
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers={"Content-Type": content_type}
            )

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Proxy error: {str(e)}"
        )


@router.api_route("/v4/map/styles", methods=["GET", "POST"])
async def proxy_map_styles(request: Request):
    """
    代理地图样式请求到 webapi.amap.com
    """
    return await proxy_request(
        request,
        WEBAPI_BASE,
        "/v4/map/styles",
        {"jscode": AMAP_SECURITY_KEY}
    )


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_all(request: Request, path: str = ""):
    """
    代理所有其他请求到 restapi.amap.com
    """
    target_path = f"/{path}" if path else "/"
    return await proxy_request(
        request,
        RESTAPI_BASE,
        target_path,
        {"jscode": AMAP_SECURITY_KEY}
    )


# 兼容性：也支持根路径
@router.api_route("/", methods=["GET", "POST"])
async def proxy_root(request: Request):
    """
    代理根路径请求
    """
    return await proxy_request(
        request,
        RESTAPI_BASE,
        "/",
        {"jscode": AMAP_SECURITY_KEY}
    )
