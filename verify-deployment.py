#!/usr/bin/env python3
"""部署验证脚本 - 在完成 OSS 控制台配置后运行此脚本"""

from playwright.sync_api import sync_playwright
import time

print("="*60)
print("🚀 照片分享服务部署验证")
print("="*60)
print("\n⚠️  运行此脚本前，请确保已完成：")
print("   1. 在 OSS 控制台设置 Bucket 为公共读")
print("   2. 等待 DNS 生效（10-30分钟）")
print("\n按 Enter 继续...")
input()

URLS = {
    "OSS HTTP": "http://photo-share-hub-20260212.oss-cn-hangzhou.aliyuncs.com/index.html",
    "OSS HTTPS": "https://photo-share-hub-20260212.oss-cn-hangzhou.aliyuncs.com/index.html",
    "CDN HTTP": "http://www.picshare.com.cn",
    "CDN HTTPS": "https://www.picshare.com.cn"
}

results = {}

def test_url(name, url):
    """测试单个 URL"""
    print(f"\n{'='*60}")
    print(f"🧪 测试: {name}")
    print(f"🌐 URL: {url}")
    print('-'*60)
    
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1920, 'height': 1080})
            
            response = page.goto(url, wait_until='domcontentloaded', timeout=15000)
            status = response.status
            
            if status == 200:
                page.wait_for_timeout(2000)
                
                # 截图
                filename = name.replace(' ', '_').lower()
                screenshot = f'/workspace/screenshot_{filename}.png'
                page.screenshot(path=screenshot, full_page=True)
                
                title = page.title()
                content_length = len(page.content())
                
                print(f"✅ 状态码: {status}")
                print(f"📄 页面标题: {title}")
                print(f"📊 内容大小: {content_length} bytes")
                print(f"📸 截图: {screenshot}")
                
                browser.close()
                return {"status": "成功", "code": status, "screenshot": screenshot, "title": title}
            else:
                print(f"⚠️  状态码: {status}")
                browser.close()
                return {"status": "失败", "code": status, "reason": f"HTTP {status}"}
                
        except Exception as e:
            error = str(e)
            if "ERR_NAME_NOT_RESOLVED" in error:
                print("❌ DNS 解析失败（域名未生效或配置错误）")
                return {"status": "失败", "reason": "DNS解析失败"}
            elif "ERR_CONNECTION_REFUSED" in error:
                print("❌ 连接被拒绝")
                return {"status": "失败", "reason": "连接被拒绝"}
            elif "403" in error or "AccessDenied" in error:
                print("❌ 403 访问被拒绝（OSS权限未配置）")
                return {"status": "失败", "reason": "权限错误"}
            else:
                print(f"❌ 错误: {error[:100]}")
                return {"status": "失败", "reason": error[:100]}

# 测试所有 URL
for name, url in URLS.items():
    results[name] = test_url(name, url)
    time.sleep(2)

# 输出总结
print("\n" + "="*60)
print("📊 测试结果汇总")
print("="*60)

success_count = sum(1 for r in results.values() if r.get("status") == "成功")
total_count = len(results)

for name, result in results.items():
    status = result.get("status")
    if status == "成功":
        print(f"✅ {name}: {result.get('code')} - {result.get('title')}")
        print(f"   📸 {result.get('screenshot')}")
    else:
        print(f"❌ {name}: {result.get('reason')}")

print(f"\n{'='*60}")
print(f"总计: {success_count}/{total_count} 成功")

if success_count == 0:
    print("\n🔧 建议:")
    print("   1. 检查 OSS Bucket 权限是否已设置为公共读")
    print("   2. 等待 DNS 生效（通常需要10-30分钟）")
    print("   3. 访问 OSS 控制台确认配置")
    print("   4. 10分钟后重新运行此脚本")
elif success_count < total_count:
    if results.get("OSS HTTP", {}).get("status") == "成功":
        print("\n✅ OSS 配置正确！")
        if results.get("CDN HTTP", {}).get("status") == "失败":
            print("⏳ CDN 域名还在生效中，请等待10-30分钟")
    else:
        print("\n⚠️  OSS 访问失败，请检查 Bucket 权限配置")
else:
    print("\n🎉 恭喜！所有服务都部署成功！")
    print(f"\n🌐 你的网站地址:")
    print(f"   主域名: http://www.picshare.com.cn")
    if results.get("CDN HTTPS", {}).get("status") == "成功":
        print(f"   HTTPS:  https://www.picshare.com.cn")
    print(f"\n📸 所有截图已保存到 /workspace/ 目录")

print("="*60)
