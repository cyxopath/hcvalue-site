/* ───────────────────────────────────────────────────────────
   HC Values – script.js
   ─────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    
    /* ── URL Parameter Auto-Login, Roblox & Discord OAuth Notices ── */
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get('key');
    const robloxError = urlParams.get('roblox_error');
    const robloxSuccess = urlParams.get('roblox_success');
    const robloxToken = urlParams.get('roblox_token');
    const robloxUserParam = urlParams.get('roblox_user');
    const discordError = urlParams.get('discord_error');
    const discordSuccess = urlParams.get('discord_success');

    function renderAuthCallbackNotice(title, subtitle, isSuccess) {
        document.body.innerHTML = `
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #070709; font-family: 'Outfit', sans-serif; color: #f0f0f5; padding: 1.5rem; text-align: center;">
                <div style="background: rgba(14, 16, 26, 0.94); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 24px; padding: 2.5rem 2rem; max-width: 400px; width: 100%; box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8), 0 0 45px rgba(168, 85, 247, 0.15); animation: cardPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
                    <div style="width: 58px; height: 58px; border-radius: 50%; background: ${isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1.5px solid ${isSuccess ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 1.6rem; color: ${isSuccess ? '#4ade80' : '#f87171'};">
                        ${isSuccess ? '✓' : '✕'}
                    </div>
                    <h2 style="font-size: 1.35rem; font-weight: 700; margin-bottom: 0.5rem; letter-spacing: -0.01em;">${title}</h2>
                    <p style="font-size: 0.86rem; color: #888899; line-height: 1.5; margin-bottom: 1.5rem;">${subtitle}</p>
                    <button onclick="window.close()" style="height: 42px; padding: 0 1.6rem; border-radius: 100px; border: none; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #fff; font-size: 0.84rem; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                        Close Tab
                    </button>
                </div>
            </div>
        `;
    }

    if (robloxError) {
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: 'ROBLOX_AUTH_ERROR', error: robloxError }, '*');
            } catch (_) {}
            renderAuthCallbackNotice('Roblox Connection Notice', robloxError.replace(/_/g, ' '), false);
            return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => alert(`Roblox Login Notice: ${robloxError.replace(/_/g, ' ')}`), 300);
    }
    if (robloxSuccess && robloxToken) {
        localStorage.setItem('hc_session_token', robloxToken);
        if (robloxUserParam) {
            try {
                localStorage.setItem('roblox_user', decodeURIComponent(robloxUserParam));
            } catch (_) {}
        }
        localStorage.setItem('roblox_oauth_event', Date.now().toString());

        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({
                    type: 'ROBLOX_AUTH_SUCCESS',
                    token: robloxToken,
                    user: robloxUserParam
                }, '*');
            } catch (_) {}
            renderAuthCallbackNotice('Connected to Roblox!', 'Successfully authenticated. Closing tab...', true);
            setTimeout(() => { window.close(); }, 700);
            return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (discordError) {
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: discordError }, '*');
            } catch (_) {}
            renderAuthCallbackNotice('Discord Connection Notice', discordError.replace(/_/g, ' '), false);
            return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => alert(`Discord Connection Notice: ${discordError.replace(/_/g, ' ')}`), 300);
    }
    if (discordSuccess) {
        localStorage.setItem('discord_oauth_event', Date.now().toString());

        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: 'DISCORD_AUTH_SUCCESS' }, '*');
            } catch (_) {}
            renderAuthCallbackNotice('Connected to Discord!', 'Discord account linked. Closing tab...', true);
            setTimeout(() => { window.close(); }, 700);
            return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlKey) {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ key: urlKey })
        });
        const result = await res.json();
        if (result.success) {
            // We'll trigger the admin view after the data loads
            window.autoAdmin = true;
            
            // Set the mock user session to bypass Roblox verification locally
            const mockUser = {
                id: 1945506007,
                username: 'cyxopathic',
                displayName: 'Developer',
                avatarUrl: 'shield.png',
                loginTime: Date.now()
            };
            localStorage.setItem('roblox_user', JSON.stringify(mockUser));
            localStorage.setItem('hc_session_token', 'mock_dev_token');
            localStorage.setItem('admin_token', 'mock_dev_token');
            localStorage.setItem('dev_key', 'roblox_verified');
        }
    }

    async function initAdminVotesLookup() {
        const select = document.getElementById('admin-skin-select');
        const results = document.getElementById('admin-skin-vote-results');
        const refreshBtn = document.getElementById('admin-skin-refresh-btn');

        if (!select || !results || !refreshBtn) return;

        const buildOptions = () => {
            select.innerHTML = '<option value="">— Select a category —</option>';
            if (!siteData || !siteData.categories) return;
            Object.keys(siteData.categories).sort().forEach(catName => {
                const option = document.createElement('option');
                option.value = catName;
                option.textContent = catName;
                select.appendChild(option);
            });
        };

        const parsePrice = (val) => {
            if (!val) return 0;
            let clean = val.toString().replace(/\./g, '').replace(/,/g, '').trim();
            let num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        const loadVotesForSelection = async () => {
            const categoryName = select.value;
            if (!categoryName) {
                results.innerHTML = '<div style="color:var(--text-3); font-style:italic; padding:0.5rem 0;">Pick a category above to view vote totals.</div>';
                return;
            }
            results.innerHTML = '<div style="color:var(--text-3);">Loading...</div>';
            try {
                const res = await fetch('/api/admin/votes', { headers: getAdminHeaders() });
                const data = await res.json();
                if (!data.success) {
                    results.innerHTML = `<div style="color:#f87171;">${data.message || 'Unable to retrieve vote results.'}</div>`;
                    return;
                }
                const allVotes = data.votes || [];
                const category = siteData.categories[categoryName];
                if (!category || !category.items) {
                    results.innerHTML = '<div style="color:var(--text-3);">Category not found.</div>';
                    return;
                }

                // Sort skins by price descending
                const skins = Object.keys(category.items).sort((a, b) => {
                    return parsePrice(category.items[b].usd) - parsePrice(category.items[a].usd);
                });

                if (!skins.length) {
                    results.innerHTML = '<div style="color:var(--text-3);">No skins found for this category.</div>';
                    return;
                }

                let html = '';
                skins.forEach(name => {
                    const item = category.items[name];
                    const entry = allVotes.find(v => String(v.category) === categoryName && String(v.skinName) === name);
                    const counts = entry?.counts || { overprice: 0, perfect: 0, underprice: 0 };
                    const votes = entry?.votes || [];
                    const totalVotes = (counts.overprice || 0) + (counts.perfect || 0) + (counts.underprice || 0);

                    // Distribution bar
                    let distBar = '';
                    if (totalVotes > 0) {
                        const overPct = (counts.overprice / totalVotes) * 100;
                        const perfectPct = (counts.perfect / totalVotes) * 100;
                        const underPct = (counts.underprice / totalVotes) * 100;
                        distBar = `<div style="display:flex;height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,0.05);margin:0.55rem 0;">
                            <div style="width:${overPct}%;background:#ef4444;"></div>
                            <div style="width:${perfectPct}%;background:#22c55e;"></div>
                            <div style="width:${underPct}%;background:#3b82f6;"></div>
                        </div>`;
                    }

                    // User vote chips
                    const userChips = votes.length
                        ? votes.map(v => {
                            let c = 'var(--text-3)', label = v.vote;
                            if (v.vote === 'overprice') { c = '#ef4444'; label = 'Over'; }
                            else if (v.vote === 'perfect') { c = '#22c55e'; label = 'Fair'; }
                            else if (v.vote === 'underprice') { c = '#3b82f6'; label = 'Under'; }
                            return `<span style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:0.12rem 0.4rem;border-radius:4px;font-size:0.73rem;margin:0.15rem 0.25rem 0.15rem 0;display:inline-block;">
                                <strong>${v.username}</strong>: <span style="color:${c};font-weight:700;">${label}</span>
                            </span>`;
                        }).join('')
                        : `<span style="color:var(--text-3);font-style:italic;font-size:0.8rem;">No votes yet.</span>`;

                    html += `
                        <div style="border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:0.8rem;background:rgba(255,255,255,0.015);">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;">
                                <div>
                                    <div style="font-weight:700;font-size:0.88rem;color:#fff;">${name}</div>
                                    <div style="font-size:0.72rem;color:var(--text-3);margin-top:0.1rem;">
                                        <span style="color:var(--accent-2);font-weight:600;">$${item.usd || 'N/A'}</span> USD
                                        ${item.robux && item.robux !== 'X' ? `• <span style="color:var(--text-2);">${item.robux} Robux</span>` : ''}
                                    </div>
                                </div>
                                <div style="display:flex;gap:0.6rem;font-size:0.76rem;background:rgba(255,255,255,0.02);padding:0.25rem 0.55rem;border-radius:6px;border:1px solid rgba(255,255,255,0.04);align-items:center;">
                                    <span style="color:#ef4444;">▲ <strong>${counts.overprice}</strong></span>
                                    <span style="color:#22c55e;">● <strong>${counts.perfect}</strong></span>
                                    <span style="color:#3b82f6;">▼ <strong>${counts.underprice}</strong></span>
                                </div>
                            </div>
                            ${distBar}
                            <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px dashed rgba(255,255,255,0.04);">
                                <div style="font-size:0.67rem;text-transform:uppercase;color:var(--text-3);letter-spacing:0.05em;margin-bottom:0.25rem;">Voters:</div>
                                <div style="display:flex;flex-wrap:wrap;">${userChips}</div>
                            </div>
                        </div>
                    `;
                });

                results.innerHTML = html;
            } catch (err) {
                console.error('Vote lookup error', err);
                results.innerHTML = `<div style="color:#f87171;">Error loading results.</div>`;
            }
        };

        select.addEventListener('change', loadVotesForSelection);
        refreshBtn.addEventListener('click', loadVotesForSelection);
        buildOptions();
        // Show placeholder immediately
        results.innerHTML = '<div style="color:var(--text-3); font-style:italic; padding:0.5rem 0;">Pick a category above to view vote totals.</div>';
    }

    async function initAdminAllSkinsByPrice() {
        const btn = document.getElementById('admin-btn-load-all-skins');
        const results = document.getElementById('admin-all-skins-results');

        if (!btn || !results) return;

        const loadAllSkins = async () => {
            results.innerHTML = '<div style="color:var(--text-3);">Loading voted skins...</div>';
            try {
                const res = await fetch('/api/admin/votes', {
                    headers: getAdminHeaders()
                });
                const data = await res.json();
                if (!data.success) {
                    results.innerHTML = `<div style="color:#f87171;">${data.message || 'Unable to retrieve skins.'}</div>`;
                    return;
                }
                const allVotes = data.votes || [];
                
                // Helper to parse price string to number for sorting
                const parsePrice = (val) => {
                    if (!val) return 0;
                    let clean = val.toString().replace(/\./g, '').replace(/,/g, '').trim();
                    let num = parseFloat(clean);
                    return isNaN(num) ? 0 : num;
                };

                // Filter out entries with no votes
                const activeVoteEntries = allVotes.filter(entry => {
                    const counts = entry.counts || { overprice: 0, perfect: 0, underprice: 0 };
                    return ((counts.overprice || 0) + (counts.perfect || 0) + (counts.underprice || 0)) > 0;
                });

                if (!activeVoteEntries.length) {
                    results.innerHTML = '<div style="color:var(--text-3);">No skins with votes found.</div>';
                    return;
                }

                // Group by category
                const grouped = {};
                
                activeVoteEntries.forEach(entry => {
                    const catName = entry.category || 'Uncategorized';
                    if (!grouped[catName]) {
                        grouped[catName] = [];
                    }
                    
                    // Look up item details in siteData for original prices
                    let priceStr = '0';
                    let robuxStr = '0';
                    if (siteData && siteData.categories && siteData.categories[catName]) {
                        const item = siteData.categories[catName].items?.[entry.skinName];
                        if (item) {
                            priceStr = item.usd || '0';
                            robuxStr = item.robux || '0';
                        }
                    }

                    grouped[catName].push({
                        name: entry.skinName,
                        category: catName,
                        priceVal: parsePrice(priceStr),
                        priceStr: priceStr,
                        robuxStr: robuxStr,
                        counts: entry.counts || { overprice: 0, perfect: 0, underprice: 0 },
                        votes: entry.votes || []
                    });
                });

                // Render categorized results
                let html = '';
                
                // Sort categories alphabetically
                const sortedCategories = Object.keys(grouped).sort();
                
                sortedCategories.forEach(catName => {
                    const skins = grouped[catName];
                    // Sort skins in this category by price descending (highest to lowest)
                    skins.sort((a, b) => b.priceVal - a.priceVal);
                    
                    html += `
                        <div class="admin-vote-category-group" style="margin-bottom: 1.5rem;">
                            <div style="font-size: 0.95rem; font-weight: 800; color: var(--accent); border-bottom: 1px solid rgba(162, 89, 255, 0.2); padding-bottom: 0.4rem; margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center;">
                                <span>${catName}</span>
                                <span style="font-size: 0.75rem; background: rgba(162, 89, 255, 0.1); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid rgba(162, 89, 255, 0.2); color: var(--accent-2);">${skins.length} skin${skins.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    `;
                    
                    skins.forEach(skin => {
                        const totalVotes = skin.counts.overprice + skin.counts.perfect + skin.counts.underprice;
                        const userList = skin.votes.length 
                            ? skin.votes.map(v => {
                                let voteColor = 'var(--text-3)';
                                if (v.vote === 'overprice') voteColor = '#ef4444';
                                else if (v.vote === 'perfect') voteColor = '#22c55e';
                                else if (v.vote === 'underprice') voteColor = '#3b82f6';
                                return `<span style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.15rem 0.45rem; border-radius: 4px; display: inline-block; font-size: 0.75rem; margin-right: 0.3rem; margin-bottom: 0.3rem;">
                                    <strong>${v.username}</strong>: <span style="color: ${voteColor}; font-weight: 700;">${v.vote === 'overprice' ? 'Over' : v.vote === 'perfect' ? 'Fair' : 'Under'}</span>
                                </span>`;
                            }).join('')
                            : '<span style="color: var(--text-3); font-style: italic;">No votes yet.</span>';
                            
                        // Mini distribution bar
                        let distributionBar = '';
                        if (totalVotes > 0) {
                            const overPct = (skin.counts.overprice / totalVotes) * 100;
                            const perfectPct = (skin.counts.perfect / totalVotes) * 100;
                            const underPct = (skin.counts.underprice / totalVotes) * 100;
                            distributionBar = `
                                <div style="display: flex; height: 4px; border-radius: 2px; overflow: hidden; background: rgba(255,255,255,0.05); margin-top: 0.6rem; margin-bottom: 0.6rem; width: 100%;">
                                    <div style="width: ${overPct}%; background: #ef4444;"></div>
                                    <div style="width: ${perfectPct}%; background: #22c55e;"></div>
                                    <div style="width: ${underPct}%; background: #3b82f6;"></div>
                                </div>
                            `;
                        }

                        html += `
                            <div style="border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.85rem; background: rgba(255,255,255,0.01); transition: all 0.2s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #fff;">${skin.name}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-3); margin-top: 0.15rem;">
                                            Price: <span style="color: var(--accent-2); font-weight: 600;">$${skin.priceStr} USD</span> • <span style="color: var(--text-2);">${skin.robuxStr} Robux</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 0.75rem; font-size: 0.78rem; background: rgba(255,255,255,0.02); padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);"> 
                                        <span style="color: #ef4444;">Over: <strong>${skin.counts.overprice}</strong></span>
                                        <span style="color: #22c55e;">Fair: <strong>${skin.counts.perfect}</strong></span>
                                        <span style="color: #3b82f6;">Under: <strong>${skin.counts.underprice}</strong></span>
                                    </div>
                                </div>
                                ${distributionBar}
                                <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.04); padding-top: 0.5rem;">
                                    <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-3); letter-spacing: 0.05em; margin-bottom: 0.3rem;">User Votes:</div>
                                    <div style="display: flex; flex-wrap: wrap;">${userList}</div>
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                });

                results.innerHTML = html;
            } catch (err) {
                console.error('All skins lookup error', err);
                results.innerHTML = `<div style="color:#f87171;">Error loading results.</div>`;
            }
        };

        btn.addEventListener('click', loadAllSkins);
    }


    /* ── DOM refs ─────────────────────────────────────────── */
    const pageWrapper = document.getElementById('page-wrapper');
    const leftPanel = document.getElementById('left-panel');
    const catalog = document.getElementById('catalog');
    const discoverBtn = document.getElementById('discover-btn');

    // Landing/Hero section
    const landing = document.getElementById('landing');
    const categoriesSection = document.getElementById('categories-section');
    const trendingSection = document.getElementById('trending-section');
    const trendingGrid = document.getElementById('trending-grid');

    // Values section
    const categoryNav = document.getElementById('category-nav');
    const itemsGrid = document.getElementById('items-grid');
    const emptyState = document.getElementById('empty-state');
    const itemsHeader = document.getElementById('items-header');
    const catTitle = document.getElementById('current-category-title');
    const countLabel = document.getElementById('items-count-label');

    // Exclusive section (right panel)
    const exclCategoryNav = document.getElementById('excl-category-nav');
    const exclItemsGrid = document.getElementById('excl-items-grid');
    const exclItemsHeader = document.getElementById('excl-items-header');
    const exclCatTitle = document.getElementById('excl-cat-title');
    const exclCountLabel = document.getElementById('excl-count-label');
    const exclEmptyState = document.getElementById('excl-empty-state');

    // Nav
    const navUnderline = document.getElementById('nav-underline');
    const navLinkHome = document.getElementById('navlink-home');
    const navLinkValues = document.getElementById('navlink-values');
    const navLinkExclusive = document.getElementById('navlink-exclusive');
    const navLinkTradingServer = document.getElementById('navlink-trading-server');
    const navLinkPrices = document.getElementById('navlink-prices');
    const navLinkAdmin = document.getElementById('navlink-admin');
    const navHomeLogo = document.getElementById('nav-home-logo');
    const allNavLinks = document.querySelectorAll('.nav-link, .di-link');

    // Admin Specific
    const adminSection = document.getElementById('admin-section');
    const totalClicksEl = document.getElementById('total-clicks');
    const trafficChartEl = document.getElementById('traffic-chart');
    const adminSkinSearch = document.getElementById('admin-skin-search');
    const adminEditGrid = document.getElementById('admin-edit-grid');
    const addSkinCatSelect = document.getElementById('add-skin-cat');
    const addSkinUsd = document.getElementById('add-skin-usd');
    const addSkinRobux = document.getElementById('add-skin-robux');
    const btnAddSkin = document.getElementById('btn-add-skin');
    const globalSearch = document.getElementById('global-search');

    /* ─────────────────────────────────────────────────────────
       TRENDING ITEMS  (category → item name)
    ───────────────────────────────────────────────────────── */
    let TRENDING_ITEMS = [
        { cat: 'Knives', name: 'Beta' },
        { cat: 'Knives', name: 'Fishbone' },
        { cat: 'Double Barrel', name: 'Poseidon' },
        { cat: 'Revolver', name: 'Poseidon' },
        { cat: 'Tactical', name: 'Poseidon' },
        { cat: 'Double Barrel', name: 'Shiryus Breath' },
        { cat: 'Revolver', name: 'Shiryus Breath' },
        { cat: 'Tactical', name: 'Shiryus Breath' },
    ];

    /* ─────────────────────────────────────────────────────────
       FILTER RULES
    ───────────────────────────────────────────────────────── */
    const HARDCODED_EXCLUSIVES = [];

    const TIER_ITEMS = [
        { 
            name: 'Tier 1 (Base Mod)', 
            usd: ' N/A', 
            customIcon: true,
            customImg: 'images/Moderator.png',
            features: {
                inGame: [
                    { label: 'Spectate' },
                    { label: 'Teleport' },
                    { label: 'Kick' },
                    { label: 'Bring' },
                    { label: 'Force Reset' },
                    { label: 'Audit Logs' }
                ],
                discord: [
                    { label: 'Moderator Assistant Role' },
                    { label: 'Ban Logs Server Invite' },
                    { label: 'Ban command' }
                ]
            }
        },
        { 
            name: 'Tier 2', 
            usd: ' N/A', 
            customIcon: true,
            customImg: 'images/Moderator.png',
            features: {
                inGame: [
                    { label: '(All Tier 1 Mod Features)' },
                    { label: 'Bullet Deflect', preview: 'videos/bullet-deflect.mp4' },
                    { label: 'Freeze Player' }
                ],
                discord: [
                    { label: 'Moderator Assistant Role' },
                    { label: 'Ban Logs Server Invite' },
                    { label: 'Ban command' }
                ]
            }
        },
        { 
            name: 'Tier 3', 
            usd: ' N/A', 
            customIcon: true,
            customImg: 'images/Moderator.png',
            features: {
                inGame: [
                    { label: '(All Tier 1+2 Mod Features)' },
                    { label: 'Server Ban' },
                    { label: 'Knife Deflect', preview: 'videos/knife-deflect.mp4' },
                    { 
                        label: 'Telekenesis', 
                        preview: 'videos/telekenesis.mp4',
                        sub: [
                            { label: 'Throw', preview: 'videos/throw.mp4' },
                            { label: 'Kill', preview: 'videos/kill.mp4' }
                        ]
                    },
                    { label: 'Invisibility', preview: 'videos/invisibility.mp4' }
                ],
                discord: [
                    { label: 'Moderator Assistant Role' },
                    { label: 'Ban Logs Server Invite' },
                    { label: 'Ban command' }
                ]
            }
        }
    ];

    const HIDDEN_CATEGORIES = new Set(['Gun Skins', 'Gun Skins 2', 'Others']);
    const EXCL_HIDDEN_CATS = new Set([]);
    const EXCL_HIDDEN_ITEMS = new Set(['Loot Capsule', 'Capsule Key']);

    let siteData = null;
    let activeView = 'home';
    let activeCategory = null;
    let exclBuilt = false;   // only build exclusive panel once
    let availableFiles = { images: [], gifs: [], videos: [] }; // populated from server
    let sessionsInterval = null;
    let pricesInterval = null;

    // Note: availableFiles is now fetched concurrently with data.json below to prevent race conditions.

    /* ── Canvas Particle BG ───────────────────────────────── */
    (function initCanvas() {
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let W, H, particles;
        let lastW = 0;
        function resize() {
            const currentW = window.innerWidth;
            const currentH = window.innerHeight;
            
            W = canvas.width = currentW;
            H = canvas.height = currentH;
            
            // Only re-spawn particles if the width actually changed (prevents glitching on mobile scroll)
            if (currentW !== lastW) {
                lastW = currentW;
                spawnParticles();
            }
        }
        function spawnParticles() {
            particles = Array.from({ length: 80 }, () => ({
                x: Math.random() * W, y: Math.random() * H,
                r: Math.random() * 1.4 + 0.3,
                dx: (Math.random() - 0.5) * 0.25,
                dy: (Math.random() - 0.5) * 0.25,
                a: Math.random() * 0.45 + 0.1,
            }));
        }
        function draw() {
            ctx.clearRect(0, 0, W, H);
            particles.forEach(p => {
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(162,89,255,${p.a})`;
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        window.addEventListener('resize', resize);
        resize();
        draw();
    })();

    /* ── Smooth scroll within a panel element ─────────────── */
    function smoothScrollPanel(panel, targetY, duration = 240) {
        const startY = panel.scrollTop;
        const distance = targetY - startY;
        if (Math.abs(distance) < 2) return;
        const startTime = performance.now();
        function ease(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            panel.scrollTop = startY + distance * ease(progress);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /* ── Preload Previews ────────────────────────────────── */
    function preloadAssets() {
        if (!siteData) return;
        const paths = new Set();

        // 1. Hardcoded exclusives
        HARDCODED_EXCLUSIVES.forEach(item => {
            paths.add('gifs/' + item.name.toLowerCase().replace(/ /g, '-') + '.gif');
        });

        // 2. Mod Tiers & Features
        TIER_ITEMS.forEach(tier => {
            const scan = (list) => {
                list.forEach(f => {
                    if (f.preview) {
                        let fileName = typeof f.preview === 'string' ? f.preview : f.label.toLowerCase().replace(/ /g, '-') + '.gif';
                        paths.add('gifs/' + fileName);
                    }
                    if (f.sub) scan(f.sub);
                });
            };
            if (tier.features.inGame) scan(tier.features.inGame);
            if (tier.features.discord) scan(tier.features.discord);
        });

        // 3. All items in categories (exclusives)
        Object.values(siteData.categories).forEach(cat => {
            Object.entries(cat.items || {}).forEach(([name, details]) => {
                if (details.robux === 'X') {
                    let n = name.toLowerCase().replace(/ /g, '-');
                    if (n === 'bitcoin') n = 'bitcoin-knife';
                    paths.add('gifs/' + n + '.gif');
                }
            });
        });

        // Fire off preloads
        paths.forEach(p => {
            const img = new Image();
            img.src = p;
        });
    }

    /* ── Data & Media files fetch (Concurrently) ─────────── */
    Promise.all([
        fetch('/api/files', { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ images: [], gifs: [], videos: [] })),
        fetch('/api/data', { credentials: 'same-origin' }).then(r => r.json()),
        fetch('/api/trending', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null)
    ]).then(async ([files, data, savedTrending]) => {
        availableFiles = files;
        siteData = data;
        // Use server-saved trending list if it exists
        if (Array.isArray(savedTrending) && savedTrending.length > 0) {
            TRENDING_ITEMS = savedTrending;
        }
        
        // Setup Trading Server Link
        const adminTsInput = document.getElementById('admin-trading-server-input');
        if (siteData.config && siteData.config.tradingServerLink) {
            if (navLinkTradingServer) navLinkTradingServer.href = siteData.config.tradingServerLink;
            if (adminTsInput) adminTsInput.value = siteData.config.tradingServerLink;
        }

        buildValuesCategories();
        renderTrending();
        // preloadAssets(); // Disabled to prevent browser network queue choking on page load
        initAdminCategorySelect();
        initPricesTabManager();
        await checkPricesAccess();
        initAdminDiscordSettings();
        trackVisit();
        
        if (window.autoAdmin) {
            navLinkAdmin.style.display = 'inline-block';
            navLinkAdmin.click();
        }
    }).catch(err => console.error('Failed to load initial data:', err));

    /* ── Render trending strip ───────────────────────────── */
    function renderTrending() {
        trendingGrid.innerHTML = '';
        TRENDING_ITEMS.forEach(({ cat, name }, i) => {
            const catData = siteData.categories[cat];
            if (!catData) return;
            const details = catData.items[name];
            if (!details) return;
            const card = makeCard(`${name} (${cat})`, details, i, false, true, cat);
            trendingGrid.appendChild(card);
        });
    }

    /* ─────────────────────────────────────────────────────────
       DISCOVER MORE → smooth scroll DOWN inside left panel
    ───────────────────────────────────────────────────────── */
    discoverBtn.addEventListener('click', () => {
        // catalog.offsetTop is relative to left-panel
        const targetY = catalog.offsetTop - 60; // subtract nav height
        smoothScrollPanel(leftPanel, targetY, 240);
        setActiveNavLink('values');
        activeView = 'values';
    });

    /* ─────────────────────────────────────────────────────────
       NAV: Home / Values → slide back to LEFT panel
    ───────────────────────────────────────────────────────── */
    /* ─────────────────────────────────────────────────────────
       NAVIGATION STATE MACHINE — directional setView() keeps
       panels in sync and slides smoothly based on tab position.
    ───────────────────────────────────────────────────────── */
    const VIEW_ORDER = {
        'home': 0,
        'values': 1,
        'exclusive': 2,
        'prices': 3,
        'admin': 4
    };
    let currentViewIndex = 0;

    function applySlideAnimation(el, isMovingRight) {
        if (!el) return;
        el.classList.remove('view-slide-from-right', 'view-slide-from-left');
        void el.offsetWidth; // trigger reflow
        el.classList.add(isMovingRight ? 'view-slide-from-right' : 'view-slide-from-left');
    }

    function setView(view) {
        const prevIndex = currentViewIndex;
        const newIndex = VIEW_ORDER[view] !== undefined ? VIEW_ORDER[view] : 0;
        const isMovingRight = newIndex >= prevIndex;
        currentViewIndex = newIndex;

        activeView = view;
        setActiveNavLink(view);
        const rightPanel = document.getElementById('right-panel');

        // Control visibility of the cheat floating box (show on home, values, exclusive)
        const cheatBox = document.getElementById('cheat-floating-box');
        if (cheatBox) {
            if (view === 'home' || view === 'values' || view === 'exclusive') {
                cheatBox.style.display = 'flex';
            } else {
                cheatBox.style.display = 'none';
            }
        }

        // Manage session list auto-polling
        if (view !== 'admin' && sessionsInterval) {
            clearInterval(sessionsInterval);
            sessionsInterval = null;
        }
        if (view !== 'prices' && pricesInterval) {
            clearInterval(pricesInterval);
            pricesInterval = null;
        }

        if (view === 'exclusive') {
            if (rightPanel) {
                if (!rightPanel.classList.contains('exclusive-active')) {
                    // Prepare entrance position based on source tab direction
                    rightPanel.style.transition = 'none';
                    rightPanel.style.transform = isMovingRight ? 'translateX(100%)' : 'translateX(-100%)';
                    void rightPanel.offsetWidth;
                    rightPanel.style.transition = '';
                }
                rightPanel.classList.add('exclusive-active');
                rightPanel.scrollTop = 0;
            }

            if (siteData) {
                if (!exclBuilt) {
                    buildExclusiveCategories();
                    renderModeratorTiers();
                    exclBuilt = true;
                }
                renderExclusiveAll();
            }
            if (exclItemsHeader)  exclItemsHeader.style.display  = '';
            if (exclItemsGrid)    exclItemsGrid.style.display    = '';
            if (exclEmptyState)   exclEmptyState.style.display   = 'none';

        } else {
            // Hide the right panel overlay for all other views with smooth directional exit
            if (rightPanel && rightPanel.classList.contains('exclusive-active')) {
                rightPanel.style.transform = (newIndex < 2) ? 'translateX(100%)' : 'translateX(-100%)';
                rightPanel.classList.remove('exclusive-active');
            }

            if (view === 'prices') {
                landing.style.display         = 'none';
                trendingSection.style.display = 'none';
                document.getElementById('categories-section').style.display = 'none';
                document.getElementById('items-section').style.display      = 'none';
                adminSection.style.display    = 'none';
                const pricesSec = document.getElementById('prices-section');
                pricesSec.style.display    = '';
                applySlideAnimation(pricesSec, isMovingRight);
                leftPanel.scrollTop = 0;

                refreshPricesView();

                if (!pricesInterval) {
                    pricesInterval = setInterval(() => {
                        refreshPricesView();
                    }, 10000);
                }
            } else {
                // Hide prices section for other views
                document.getElementById('prices-section').style.display = 'none';

                if (view === 'admin') {
                    landing.style.display         = 'none';
                    trendingSection.style.display = 'none';
                    document.getElementById('categories-section').style.display = 'none';
                    document.getElementById('items-section').style.display      = 'none';
                    adminSection.style.display    = '';
                    applySlideAnimation(adminSection, isMovingRight);
                    leftPanel.scrollTop = 0;

                    const chartWrap = document.getElementById('traffic-chart');
                    if (chartWrap) chartWrap.innerHTML = '';
                    refreshAdminStats();
                    renderAdminEditList();
                    if (typeof fetchBlocklist === 'function') fetchBlocklist();
                    if (typeof fetchSessions === 'function') fetchSessions();
                    if (typeof fetchPricesWhitelist === 'function') fetchPricesWhitelist();
                    
                    // Start polling session list every 5 seconds while in admin view
                    if (!sessionsInterval) {
                        sessionsInterval = setInterval(() => {
                            if (typeof fetchSessions === 'function') fetchSessions();
                        }, 5000);
                    }

                    if (!setView._trendingInited) {
                        setView._trendingInited = true;
                        initTrendingManager();
                    } else {
                        renderAdminTrendingList(); // refresh list on every admin open
                    }

                    // Fetch admin-only vote data for admin view
                    if (typeof initAdminVotesLookup === 'function') initAdminVotesLookup();
                    if (typeof initAdminAllSkinsByPrice === 'function') initAdminAllSkinsByPrice();

                } else {
                    // home or values
                    adminSection.style.display    = 'none';
                    landing.style.display         = '';
                    trendingSection.style.display = '';
                    document.getElementById('categories-section').style.display = '';

                    // Re-render trending & active category immediately to show updated prices
                    renderTrending();
                    if (activeCategory) {
                        renderCategoryItems(activeCategory);
                    }

                    if (view === 'home') {
                        document.getElementById('items-section').style.display = 'none';
                        if (prevIndex === 1) {
                            smoothScrollPanel(leftPanel, 0, 200);
                        } else {
                            applySlideAnimation(landing, isMovingRight);
                            leftPanel.scrollTop = 0;
                        }
                    } else if (view === 'values') {
                        if (prevIndex === 0) {
                            const targetY = catalog.offsetTop - 60;
                            smoothScrollPanel(leftPanel, targetY, 220);
                        } else {
                            applySlideAnimation(catalog, isMovingRight);
                            const targetY = catalog.offsetTop - 60;
                            leftPanel.scrollTop = targetY;
                        }
                    }
                }
            }
        }
    }

    function resetValuesToTrending() {
        const btnTrending = document.getElementById('btn-trending');
        if (btnTrending) btnTrending.click();
        if (globalSearch) globalSearch.value = '';
    }

    // Ad Box (Sham's Cafe) Side Minimizing & Big View Modal
    const adSlideBtn = document.getElementById('ad-slide-toggle-btn');
    const adSideExpandBtn = document.getElementById('ad-side-expand-btn');
    const cheatBoxContainer = document.getElementById('cheat-floating-box');
    const adBigModal = document.getElementById('ad-big-modal');
    const adModalCloseBtn = document.getElementById('ad-modal-close-btn');

    if (cheatBoxContainer) {
        // Toggle side minimization
        if (adSlideBtn) {
            adSlideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cheatBoxContainer.classList.toggle('side-minimized');
            });
        }

        // Round circle button expand handler
        if (adSideExpandBtn) {
            adSideExpandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cheatBoxContainer.classList.remove('side-minimized');
            });
        }

        // Clicking box opens big view modal
        cheatBoxContainer.addEventListener('click', (e) => {
            // If currently side-minimized, clicking anywhere on the visible handle opens it back out
            if (cheatBoxContainer.classList.contains('side-minimized')) {
                cheatBoxContainer.classList.remove('side-minimized');
                return;
            }
            // Do not trigger modal if clicking slide/expand buttons or links
            if (e.target.closest('#ad-slide-toggle-btn') || e.target.closest('#ad-side-expand-btn') || e.target.closest('a')) {
                return;
            }
            if (adBigModal) {
                adBigModal.style.display = 'flex';
            }
        });
    }

    if (adBigModal) {
        // Close modal when clicking close button or clicking around/outside content box
        adBigModal.addEventListener('click', (e) => {
            if (e.target === adBigModal || (adModalCloseBtn && (e.target === adModalCloseBtn || adModalCloseBtn.contains(e.target)))) {
                adBigModal.style.display = 'none';
            }
        });
    }

    navHomeLogo.addEventListener('click', e => { e.preventDefault(); resetValuesToTrending(); setView('home'); });
    navLinkHome.addEventListener('click', e => { e.preventDefault(); resetValuesToTrending(); setView('home'); });
    navLinkValues.addEventListener('click', e => {
        e.preventDefault();
        if (!localStorage.getItem('roblox_user')) {
            alert('Please connect your Roblox account to see values.');
            const btnConnect = document.getElementById('connect-roblox-btn');
            if (btnConnect) btnConnect.click();
            return;
        }
        resetValuesToTrending();
        setView('values');
        // Scroll down to catalog
        const targetY = catalog.offsetTop - 60;
        setTimeout(() => smoothScrollPanel(leftPanel, targetY, 520), 50);
    });

    navLinkExclusive.addEventListener('click', e => {
        e.preventDefault();
        if (!localStorage.getItem('roblox_user')) {
            alert('Please connect your Roblox account to see exclusive items.');
            const btnConnect = document.getElementById('connect-roblox-btn');
            if (btnConnect) btnConnect.click();
            return;
        }
        setView('exclusive');
    });

    navLinkAdmin.addEventListener('click', e => {
        e.preventDefault();
        resetValuesToTrending();
        setView('admin');
    });

    if (navLinkPrices) {
        navLinkPrices.addEventListener('click', e => {
            e.preventDefault();
            resetValuesToTrending();
            setView('prices');
        });
    }

    /* keep goLeft as alias so other code (like logout) still works */
    function goLeft(view) { resetValuesToTrending(); setView(view); }

    /* ─────────────────────────────────────────────────────────
       TRENDING MANAGER (admin panel)
    ───────────────────────────────────────────────────────── */
    function saveTrendingToServer() {
        return fetch('/api/trending', {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify(TRENDING_ITEMS)
        });
    }

    function renderAdminTrendingList() {
        const list = document.getElementById('admin-trending-list');
        if (!list) return;
        list.innerHTML = '';

        if (TRENDING_ITEMS.length === 0) {
            list.innerHTML = '<div class="trending-empty-note">No trending items set. Add some above.</div>';
            return;
        }

        TRENDING_ITEMS.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'trending-admin-row';
            row.style.animationDelay = `${idx * 0.03}s`;
            row.innerHTML = `
                <div class="trending-admin-row-info">
                    <div class="trending-admin-row-name">${item.name}</div>
                    <div class="trending-admin-row-cat">${item.cat}</div>
                </div>
                <button class="trending-remove-btn">Remove</button>
            `;
            row.querySelector('.trending-remove-btn').addEventListener('click', async () => {
                TRENDING_ITEMS.splice(idx, 1);
                await saveTrendingToServer();
                renderTrending();          // update live site
                renderAdminTrendingList(); // update admin panel
            });
            list.appendChild(row);
        });
    }

    function initTrendingManager() {
        const catInput  = document.getElementById('trending-cat-input');
        const nameInput = document.getElementById('trending-name-input');
        const addBtn    = document.getElementById('trending-add-btn');
        const catSugg   = document.getElementById('trending-cat-suggestions');
        const nameSugg  = document.getElementById('trending-name-suggestions');
        if (!catInput || !nameInput || !addBtn) return;

        renderAdminTrendingList();

        // ── Category autocomplete ──
        catInput.addEventListener('input', () => {
            const q = catInput.value.trim().toLowerCase();
            catSugg.innerHTML = '';
            if (!q || !siteData) { catSugg.style.display = 'none'; return; }
            const cats = Object.keys(siteData.categories).filter(c => c.toLowerCase().includes(q));
            if (cats.length === 0) { catSugg.style.display = 'none'; return; }
            cats.slice(0, 10).forEach(cat => {
                const d = document.createElement('div');
                d.className = 'trending-suggestion-item';
                d.textContent = cat;
                d.addEventListener('mousedown', e => {
                    e.preventDefault();
                    catInput.value = cat;
                    catSugg.style.display = 'none';
                    nameInput.focus();
                });
                catSugg.appendChild(d);
            });
            catSugg.style.display = 'block';
        });
        catInput.addEventListener('blur', () => setTimeout(() => { catSugg.style.display = 'none'; }, 150));

        // ── Skin name autocomplete (based on selected category) ──
        nameInput.addEventListener('input', () => {
            const q   = nameInput.value.trim().toLowerCase();
            const cat = catInput.value.trim();
            nameSugg.innerHTML = '';
            if (!q || !siteData) { nameSugg.style.display = 'none'; return; }
            const catData = siteData.categories[cat];
            const items = catData ? Object.keys(catData.items || {}) : [];
            // If no matching cat, search all categories
            const pool = items.length > 0 ? items :
                Object.values(siteData.categories).flatMap(c => Object.keys(c.items || {}));
            const matches = pool.filter(n => n.toLowerCase().includes(q));
            if (matches.length === 0) { nameSugg.style.display = 'none'; return; }
            matches.slice(0, 10).forEach(skinName => {
                const d = document.createElement('div');
                d.className = 'trending-suggestion-item';
                d.textContent = skinName;
                d.addEventListener('mousedown', e => {
                    e.preventDefault();
                    nameInput.value = skinName;
                    nameSugg.style.display = 'none';
                });
                nameSugg.appendChild(d);
            });
            nameSugg.style.display = 'block';
        });
        nameInput.addEventListener('blur', () => setTimeout(() => { nameSugg.style.display = 'none'; }, 150));

        // ── Add button ──
        addBtn.addEventListener('click', async () => {
            const cat  = catInput.value.trim();
            const name = nameInput.value.trim();
            if (!cat || !name) { alert('Please enter both a category and a skin name.'); return; }

            // Validate they exist in siteData
            const catData = siteData?.categories[cat];
            if (!catData) { alert(`Category "${cat}" not found.`); return; }
            if (!catData.items?.[name]) { alert(`Skin "${name}" not found in "${cat}".`); return; }

            // Prevent duplicates
            const duplicate = TRENDING_ITEMS.some(t => t.cat === cat && t.name === name);
            if (duplicate) { alert(`"${name}" from "${cat}" is already trending.`); return; }

            TRENDING_ITEMS.push({ cat, name });
            await saveTrendingToServer();
            renderTrending();
            renderAdminTrendingList();

            catInput.value  = '';
            nameInput.value = '';
            catSugg.style.display  = 'none';
            nameSugg.style.display = 'none';
        });

        // Also allow Enter key on name input
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });
    }

    /* ── Early DOM refs needed by session init (must be before session logic) ─── */
    const navUserArea     = document.getElementById('nav-user-area');
    const connectOverlay  = document.getElementById('auth-wizard-overlay');
    const stepInput       = document.getElementById('roblox-modal-step-input');
    const stepLoading     = document.getElementById('roblox-modal-loading');
    const stepResult      = document.getElementById('roblox-modal-result');
    const usernameInput   = document.getElementById('roblox-username-input');
    const modalError      = document.getElementById('roblox-modal-error');
    const btnSearch       = document.getElementById('roblox-btn-search');
    const resultAvatar    = document.getElementById('roblox-result-avatar');
    const resultDisplayName = document.getElementById('roblox-result-displayname');
    const resultUsername  = document.getElementById('roblox-result-username');
    const btnCancel       = document.getElementById('roblox-btn-cancel');
    const btnConfirm      = document.getElementById('roblox-btn-confirm');

    let resolvedUser = null; // declared early to avoid TDZ when openConnectModal/logoutUser run before line 2298

    /* ── Auth Wizard Controller (3-step mandatory verification) ── */
    const AuthWizard = {
        currentStep: 1,

        updateState(step, user = null, discord = null) {
            this.currentStep = step;

            const row1 = document.getElementById('auth-step-row-1');
            const row2 = document.getElementById('auth-step-row-2');
            const row3 = document.getElementById('auth-step-row-3');

            const btnRoblox = document.getElementById('btn-auth-roblox');
            const chipRoblox = document.getElementById('auth-step-1-completed');
            const avatarRoblox = document.getElementById('auth-roblox-avatar');
            const nameRoblox = document.getElementById('auth-roblox-name');

            const btnDiscord = document.getElementById('btn-connect-discord-oauth');
            const chipDiscord = document.getElementById('auth-step-2-completed');
            const avatarDiscord = document.getElementById('auth-discord-avatar');
            const nameDiscord = document.getElementById('auth-discord-name');

            const btnJoin = document.getElementById('btn-join-discord-server');
            const btnCheck = document.getElementById('btn-check-discord-membership');
            const chipServer = document.getElementById('auth-step-3-completed');
            const pollNotice = document.getElementById('auth-card-poll-notice');

            // Reset rows
            [row1, row2, row3].forEach(r => { if (r) r.className = 'auth-step-row'; });

            // STEP 1 State
            if (step === 1) {
                if (row1) row1.classList.add('active');
                if (btnRoblox) btnRoblox.style.display = 'flex';
                if (chipRoblox) chipRoblox.style.display = 'none';

                if (row2) row2.classList.add('locked');
                if (btnDiscord) { btnDiscord.classList.add('disabled'); btnDiscord.removeAttribute('href'); }
                if (chipDiscord) chipDiscord.style.display = 'none';

                if (row3) row3.classList.add('locked');
                if (btnJoin) btnJoin.classList.add('disabled');
                if (btnCheck) { btnCheck.classList.add('disabled'); btnCheck.style.display = 'none'; }
                if (chipServer) chipServer.style.display = 'none';
                if (pollNotice) pollNotice.style.display = 'none';
            } else if (step === 2) {
                // Step 1 Completed
                if (row1) row1.classList.add('completed');
                if (btnRoblox) btnRoblox.style.display = 'none';
                if (chipRoblox) {
                    chipRoblox.style.display = 'flex';
                    if (user) {
                        if (avatarRoblox) avatarRoblox.src = user.avatarUrl || 'shield.png';
                        if (nameRoblox) nameRoblox.textContent = `@${user.username || 'User'}`;
                    }
                }

                // Step 2 Active
                if (row2) row2.classList.add('active');
                if (btnDiscord) {
                    btnDiscord.classList.remove('disabled');
                    const token = localStorage.getItem('hc_session_token') || '';
                    btnDiscord.href = getApiUrl(`/api/auth/discord/login?token=${encodeURIComponent(token)}`);
                    btnDiscord.style.display = 'flex';
                }
                if (chipDiscord) chipDiscord.style.display = 'none';

                // Step 3 Locked
                if (row3) row3.classList.add('locked');
                if (btnJoin) btnJoin.classList.add('disabled');
                if (btnCheck) { btnCheck.classList.add('disabled'); btnCheck.style.display = 'none'; }
                if (chipServer) chipServer.style.display = 'none';
                if (pollNotice) pollNotice.style.display = 'none';
            } else if (step === 3) {
                // Step 1 Completed
                if (row1) row1.classList.add('completed');
                if (btnRoblox) btnRoblox.style.display = 'none';
                if (chipRoblox) {
                    chipRoblox.style.display = 'flex';
                    if (user) {
                        if (avatarRoblox) avatarRoblox.src = user.avatarUrl || 'shield.png';
                        if (nameRoblox) nameRoblox.textContent = `@${user.username || 'User'}`;
                    }
                }

                // Step 2 Completed
                if (row2) row2.classList.add('completed');
                if (btnDiscord) btnDiscord.style.display = 'none';
                if (chipDiscord) {
                    chipDiscord.style.display = 'flex';
                    if (discord) {
                        if (avatarDiscord && discord.discordAvatar) avatarDiscord.src = discord.discordAvatar;
                        if (nameDiscord && discord.discordUsername) nameDiscord.textContent = `@${discord.discordUsername}`;
                    }
                }

                // Step 3 Active
                if (row3) row3.classList.add('active');
                if (btnJoin) {
                    btnJoin.classList.remove('disabled');
                    if (discord && discord.inviteLink) btnJoin.href = discord.inviteLink;
                }
                if (btnCheck) {
                    btnCheck.classList.remove('disabled');
                    btnCheck.style.display = 'inline-flex';
                }
                if (chipServer) chipServer.style.display = 'none';
                if (pollNotice) pollNotice.style.display = 'flex';
            }
        },

        setStep(n, user = null, discord = null) {
            this.updateState(n, user, discord);
        },

        open(step = 1, user = null, discord = null) {
            this.setStep(step, user, discord);
            if (connectOverlay) {
                connectOverlay.style.display = 'flex';
                void connectOverlay.offsetWidth;
                connectOverlay.classList.add('active');
            }
        },

        close() {
            if (connectOverlay) {
                connectOverlay.classList.remove('active');
                setTimeout(() => { connectOverlay.style.display = 'none'; }, 300);
            }
            if (typeof stopDiscordPolling === 'function') {
                stopDiscordPolling();
            }
        }
    };

    /* ── Dev Access / Session Logic ──────────────────────── */
    const modalCloseBtnEl = document.getElementById('roblox-modal-close');
    const savedDevKey = localStorage.getItem('dev_key');
    const savedUserJson = localStorage.getItem('roblox_user');
    const savedUserToken = localStorage.getItem('hc_session_token');
    const restoredToken = savedUserToken || '';
    
    let isUserAdmin = false;
    let isLoggedIn = false;

    // 1. Synchronously render UI from cache if available to prevent disappear/flicker on refresh
    if (savedUserJson && restoredToken) {
        try {
            const u = JSON.parse(savedUserJson);
            isLoggedIn = true;
            if (u.isAdmin) {
                isUserAdmin = true;
            }
        } catch (e) {
            console.error("Failed to parse cached roblox_user", e);
        }
    }

    // 2. Session validation & Discord membership evaluation
    let lastDiscordData = null;

    // Always render navbar state
    renderUserNavbar();
    async function initializeSession() {
        const currentToken = localStorage.getItem('hc_session_token') || restoredToken;
        const currentUserJson = localStorage.getItem('roblox_user') || savedUserJson;
        
        if (currentUserJson && currentToken) {
            try {
                const valUrl = getApiUrl('/api/validate-session');
                const valRes = await fetch(valUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ token: currentToken })
                });
                const valData = await valRes.json();
                
                if (valData.success && valData.valid) {
                    const u = valData.user;
                    isLoggedIn = true;
                    localStorage.setItem('roblox_user', JSON.stringify(u));
                    localStorage.setItem('hc_session_token', currentToken);
                    lastDiscordData = valData.discord;
                    
                    if (u.isAdmin) {
                        isUserAdmin = true;
                    } else {
                        isUserAdmin = false;
                    }
                    
                    if (isUserAdmin) {
                        localStorage.setItem('dev_key', 'roblox_verified');
                        navLinkAdmin.style.display = 'inline-block';
                    } else {
                        localStorage.removeItem('dev_key');
                        navLinkAdmin.style.display = 'none';
                    }
                    
                    renderUserNavbar(valData.discord);
                    const pricesData = await checkPricesAccess();
                    populateDICentre(isUserAdmin, !!(pricesData && pricesData.allowed));
                    closeConnectModal();
                    handleDiscordGating(valData.discord, u);
                } else {
                    // Session invalid or cleared on server -> force logout and require login
                    await logoutUser();
                }
            } catch (e) {
                console.error('Error validating session background', e);
                await logoutUser();
            }
        } else {
            // Not logged in -> hide page and prompt for Roblox Connect immediately
            document.getElementById('page-wrapper').style.display = 'none';
            if (modalCloseBtnEl) modalCloseBtnEl.style.display = 'none';
            openConnectModal();
        }
    }

    // Run startup verification
    initializeSession();

    // Periodic & window focus membership re-check (if user leaves Discord server, kick back to login gate)
    window.addEventListener('focus', () => {
        if (isLoggedIn || localStorage.getItem('hc_session_token')) {
            initializeSession();
        }
    });

    // Listen for postMessage from OAuth popup / new tab
    window.addEventListener('message', async (e) => {
        if (e.data && e.data.type === 'ROBLOX_AUTH_SUCCESS') {
            const { token, user } = e.data;
            if (token) localStorage.setItem('hc_session_token', token);
            if (user) {
                try {
                    localStorage.setItem('roblox_user', typeof user === 'string' ? decodeURIComponent(user) : JSON.stringify(user));
                } catch (_) {}
            }
            await initializeSession();
        } else if (e.data && e.data.type === 'DISCORD_AUTH_SUCCESS') {
            await initializeSession();
        } else if (e.data && (e.data.type === 'ROBLOX_AUTH_ERROR' || e.data.type === 'DISCORD_AUTH_ERROR')) {
            const err = e.data.error || 'Authentication error';
            const modalError = document.getElementById('roblox-modal-error');
            if (modalError) {
                modalError.textContent = err.replace(/_/g, ' ');
                modalError.style.display = 'block';
            }
        }
    });

    // Cross-tab storage synchronization
    window.addEventListener('storage', async (e) => {
        if (e.key === 'hc_session_token' || e.key === 'roblox_oauth_event' || e.key === 'discord_oauth_event') {
            await initializeSession();
        }
    });

    // Explicit new tab openers on buttons
    const btnAuthRobloxEl = document.getElementById('btn-auth-roblox');
    if (btnAuthRobloxEl) {
        btnAuthRobloxEl.target = '_blank';
        btnAuthRobloxEl.addEventListener('click', (e) => {
            e.preventDefault();
            const w = window.open('/api/auth/roblox/login', '_blank');
            if (w) w.focus();
        });
    }

    const btnConnectDiscordEl = document.getElementById('btn-connect-discord-oauth');
    if (btnConnectDiscordEl) {
        btnConnectDiscordEl.target = '_blank';
        btnConnectDiscordEl.addEventListener('click', (e) => {
            e.preventDefault();
            if (btnConnectDiscordEl.classList.contains('disabled')) return;
            const token = localStorage.getItem('hc_session_token') || '';
            const url = getApiUrl(`/api/auth/discord/login?token=${encodeURIComponent(token)}`);
            const w = window.open(url, '_blank');
            if (w) w.focus();
        });
    }

    setInterval(() => {
        if (isLoggedIn) {
            initializeSession();
        }
    }, 60000);

    function trackVisit() {
        fetch('/api/track', { method: 'POST' });
    }

    async function refreshAdminStats() {
        let stats;
        try {
            const res = await fetch('/api/stats', {
                headers: getAdminHeaders()
            });
            stats = await res.json();
        } catch (e) {
            console.error('Failed to load stats:', e);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const traffic = stats.traffic || {};

        // ── Fill the 3 stat cards ──
        const totalEl = document.getElementById('total-clicks');
        const todayEl = document.getElementById('stat-today');
        const weekEl  = document.getElementById('stat-week');

        if (totalEl) totalEl.textContent = (stats.clicks || 0).toLocaleString();
        if (todayEl) todayEl.textContent  = (traffic[today] || 0).toLocaleString();

        // 7-day sum
        const last7 = Object.entries(traffic)
            .filter(([d]) => d >= new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0])
            .reduce((sum, [, v]) => sum + v, 0);
        if (weekEl) weekEl.textContent = last7.toLocaleString();

        // ── Build a 14-day date range (fill gaps with 0) ──
        const days14 = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
            days14.push(d);
        }

        const max = Math.max(...days14.map(d => traffic[d] || 0), 1);
        const tooltipEl = document.getElementById('chart-tooltip');

        trafficChartEl.innerHTML = '';

        days14.forEach(date => {
            const count = traffic[date] || 0;
            const heightPct = Math.max((count / max) * 100, count > 0 ? 4 : 0);
            const isToday = date === today;

            const barWrap = document.createElement('div');
            barWrap.className = 'chart-bar-wrap' + (isToday ? ' chart-bar-today-wrap' : '');

            // Value label on top of bar
            const valLabel = document.createElement('div');
            valLabel.className = 'chart-bar-val';
            valLabel.textContent = count > 0 ? count : '';

            const bar = document.createElement('div');
            bar.className = 'chart-bar' + (isToday ? ' chart-bar-today' : '');
            bar.style.height = `${heightPct}%`;

            // Date label below
            const [, mm, dd] = date.split('-');
            const dateLabel = document.createElement('div');
            dateLabel.className = 'chart-date-label' + (isToday ? ' today' : '');
            dateLabel.textContent = isToday ? 'Today' : `${mm}/${dd}`;

            // Tooltip on hover
            barWrap.addEventListener('mouseenter', (e) => {
                if (!tooltipEl) return;
                const fullDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                tooltipEl.textContent = `${fullDate}: ${count} visit${count !== 1 ? 's' : ''}`;
                tooltipEl.style.opacity = '1';
            });
            barWrap.addEventListener('mouseleave', () => {
                if (tooltipEl) tooltipEl.style.opacity = '0';
            });

            barWrap.appendChild(valLabel);
            barWrap.appendChild(bar);
            barWrap.appendChild(dateLabel);
            trafficChartEl.appendChild(barWrap);
        });
    }

    function initAdminCategorySelect() {
        const cats = Object.keys(siteData.categories);
        const options = cats.map(c => `<option value="${c}">${c}</option>`).join('');
        addSkinCatSelect.innerHTML = options;

        const updateAddSkinRobuxState = () => {
            if (addSkinCatSelect.value === 'Exclusives') {
                addSkinRobux.value = 'X';
                addSkinRobux.disabled = true;
            } else {
                addSkinRobux.disabled = false;
                if (addSkinRobux.value === 'X') {
                    addSkinRobux.value = '';
                }
                addSkinRobux.value = usdToRobux(addSkinUsd.value);
            }
        };

        addSkinCatSelect.addEventListener('change', updateAddSkinRobuxState);
        updateAddSkinRobuxState();

        const editCatSelect = document.getElementById('admin-edit-cat-select');
        if (editCatSelect) {
            editCatSelect.innerHTML = `<option value="">Choose Category...</option>` + options;
            editCatSelect.addEventListener('change', () => renderAdminEditList(adminSkinSearch.value));
        }
    }

    /* ── Price Math ($5 = 1k Robux) ───────────────────────── */
    function usdToRobux(usdStr) {
        const usd = parseFloat(usdStr.replace(/\./g, '').replace(/,/g, ''));
        if (isNaN(usd)) return '';
        const robux = usd * 200;
        return robux.toLocaleString('de-DE'); // Use . as separator
    }

    function renderAdminEditList(filter = '') {
        adminEditGrid.innerHTML = '';
        const selectedCat = document.getElementById('admin-edit-cat-select').value;
        const searchWrap = document.querySelector('.admin-search-wrap');

        if (!selectedCat) {
            adminEditGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 2.5rem; grid-column: 1/-1;">Select a category above to edit skins.</div>';
            if (searchWrap) searchWrap.style.display = 'none';
            return;
        }
        if (searchWrap) searchWrap.style.display = 'block';

        Object.entries(siteData.categories).forEach(([catName, cat]) => {
            if (catName !== selectedCat) return;

            // Filter items first to see if we have anything to render for this category
            const filteredItems = Object.entries(cat.items || {}).filter(([name]) => {
                return !filter || name.toLowerCase().includes(filter.toLowerCase());
            });

            if (filteredItems.length === 0) {
                adminEditGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 2.5rem; grid-column: 1/-1;">No skins found.</div>';
                return;
            }

            filteredItems.forEach(([name, details]) => {
                const row = document.createElement('div');
                row.className = 'admin-edit-row';
                row.innerHTML = `
                    <span class="edit-name-span" title="${name}">${name}</span>
                    <div class="edit-fields-wrap">
                        <div class="edit-field-group">
                            <span class="edit-field-label">USD</span>
                            <input type="text" class="edit-usd" value="${details.usd || ''}" placeholder="USD">
                        </div>
                        <div class="edit-field-group">
                            <span class="edit-field-label">Robux</span>
                            <input type="text" class="edit-robux" value="${details.robux || ''}" placeholder="Robux">
                        </div>
                    </div>
                    <div class="edit-actions-wrap">
                        <button class="save-row-btn" title="Save Changes">Save</button>
                        <button class="del-row-btn" title="Delete Item">Delete</button>
                    </div>
                `;
                
                const usdInp = row.querySelector('.edit-usd');
                const rbxInp = row.querySelector('.edit-robux');

                usdInp.addEventListener('input', () => {
                    if (rbxInp.value !== 'X') {
                        rbxInp.value = usdToRobux(usdInp.value);
                    }
                });

                row.querySelector('.save-row-btn').addEventListener('click', () => {
                    details.usd = usdInp.value;
                    details.robux = rbxInp.value;
                    saveData();
                    
                    const btn = row.querySelector('.save-row-btn');
                    const origText = btn.innerHTML;
                    btn.innerHTML = '✅ Saved';
                    btn.style.color = '#4ade80';
                    setTimeout(() => { 
                        btn.innerHTML = origText; 
                        btn.style.color = '';
                        renderAdminEditList(filter);
                    }, 1200);
                });

                row.querySelector('.del-row-btn').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete "${name}"?`)) {
                        delete cat.items[name];
                        saveData();
                        renderAdminEditList(filter);
                    }
                });

                adminEditGrid.appendChild(row);
            });
        });
    }

    adminSkinSearch.addEventListener('input', (e) => renderAdminEditList(e.target.value));

    addSkinUsd.addEventListener('input', () => {
        if (addSkinRobux.value !== 'X') {
            addSkinRobux.value = usdToRobux(addSkinUsd.value);
        }
    });

    btnAddSkin.addEventListener('click', () => {
        const cat = addSkinCatSelect.value;
        const name = document.getElementById('add-skin-name').value;
        const usd = addSkinUsd.value;
        const robux = addSkinRobux.value;

        if (!name) return alert('Enter name');
        
        if (!siteData.categories[cat].items) siteData.categories[cat].items = {};
        siteData.categories[cat].items[name] = { usd, robux };
        
        saveData();
        renderAdminEditList();
        alert(`Added ${name} to ${cat}`);
    });

    function getAdminHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-admin-token': localStorage.getItem('admin_token') || localStorage.getItem('hc_session_token') || '',
            'x-session-token': localStorage.getItem('hc_session_token') || '',
            'x-admin-id': '1945506007' // numeric fallback for owner
        };
    }

    function sortAllCategories() {
        if (!siteData || !siteData.categories) return;

        function parsePrice(val) {
            if (!val) return 0;
            // Remove dots (thousands separators) and commas, and trim
            let clean = val.toString().replace(/\./g, '').replace(/,/g, '').trim();
            let num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }

        Object.keys(siteData.categories).forEach(catName => {
            const cat = siteData.categories[catName];
            if (cat && cat.items) {
                const sortedEntries = Object.entries(cat.items).sort((a, b) => {
                    const priceA = parsePrice(a[1].usd);
                    const priceB = parsePrice(b[1].usd);
                    return priceB - priceA; // Descending
                });

                const newItems = {};
                sortedEntries.forEach(([name, details]) => {
                    newItems[name] = details;
                });
                cat.items = newItems;
            }
        });
    }

    async function saveData() {
        sortAllCategories();
        await fetch('/api/save', {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify(siteData)
        });
        if (activeCategory) {
            renderCategoryItems(activeCategory);
        }
        renderTrending();
        buildExclusiveCategories();
        renderExclusiveAll();
    }

    /* ── Token Login (auth modal) ─────────────────────────────────── */
    const btnToggleTokenLogin  = document.getElementById('btn-toggle-token-login');
    const tokenLoginSection    = document.getElementById('token-login-section');
    const tokenLoginInput      = document.getElementById('token-login-input');
    const btnSubmitTokenLogin  = document.getElementById('btn-submit-token-login');
    const tokenLoginError      = document.getElementById('token-login-error');

    if (btnToggleTokenLogin && tokenLoginSection) {
        btnToggleTokenLogin.addEventListener('click', () => {
            const isOpen = tokenLoginSection.style.display !== 'none';
            tokenLoginSection.style.display = isOpen ? 'none' : 'block';
        });
    }

    if (btnSubmitTokenLogin) {
        btnSubmitTokenLogin.addEventListener('click', async () => {
            const token = (tokenLoginInput?.value || '').trim();
            if (!token) {
                if (tokenLoginError) { tokenLoginError.textContent = 'Please paste your token first.'; tokenLoginError.style.display = 'block'; }
                return;
            }
            btnSubmitTokenLogin.disabled = true;
            btnSubmitTokenLogin.textContent = 'Logging in…';
            if (tokenLoginError) tokenLoginError.style.display = 'none';

            try {
                const res  = await fetch('/api/auth/token-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ token })
                });
                const data = await res.json();
                if (data.success && data.user) {
                    localStorage.setItem('hc_session_token', data.token);
                    localStorage.setItem('roblox_user', JSON.stringify(data.user));
                    if (tokenLoginInput) tokenLoginInput.value = '';
                    // Trigger full session init to validate, load Discord state, etc.
                    await initializeSession();
                } else {
                    if (tokenLoginError) {
                        tokenLoginError.textContent = data.message || 'Invalid token. Please contact the admin.';
                        tokenLoginError.style.display = 'block';
                    }
                }
            } catch (e) {
                if (tokenLoginError) { tokenLoginError.textContent = 'Network error. Try again.'; tokenLoginError.style.display = 'block'; }
            }
            btnSubmitTokenLogin.disabled = false;
            btnSubmitTokenLogin.textContent = 'Login';
        });

        // Also allow Enter key in the token input
        if (tokenLoginInput) {
            tokenLoginInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') btnSubmitTokenLogin.click();
            });
        }
    }

    /* ── Admin: Generate Token Panel ─────────────────────────────── */
    const btnGenerateToken       = document.getElementById('admin-btn-generate-token');
    const gentokenRobloxInput    = document.getElementById('gentoken-roblox-input');
    const gentokenDiscordIdInput = document.getElementById('gentoken-discord-id-input');
    const gentokenDiscordName    = document.getElementById('gentoken-discord-name-input');
    const gentokenResult         = document.getElementById('gentoken-result');
    const gentokenValue          = document.getElementById('gentoken-value');
    const gentokenCopyBtn        = document.getElementById('gentoken-copy-btn');
    const gentokenUserInfo       = document.getElementById('gentoken-user-info');
    const gentokenExpiresInfo    = document.getElementById('gentoken-expires-info');
    const gentokenError          = document.getElementById('gentoken-error');

    if (btnGenerateToken) {
        btnGenerateToken.addEventListener('click', async () => {
            const robloxUsername = (gentokenRobloxInput?.value || '').trim();
            const discordId      = (gentokenDiscordIdInput?.value || '').trim();
            const discordUsername = (gentokenDiscordName?.value || '').trim();

            if (gentokenResult)  gentokenResult.style.display  = 'none';
            if (gentokenError)   { gentokenError.style.display = 'none'; gentokenError.textContent = ''; }

            if (!robloxUsername) {
                if (gentokenError) { gentokenError.textContent = 'Roblox username is required.'; gentokenError.style.display = 'block'; }
                return;
            }
            if (!discordId) {
                if (gentokenError) { gentokenError.textContent = 'Discord User ID is required.'; gentokenError.style.display = 'block'; }
                return;
            }

            btnGenerateToken.disabled = true;
            btnGenerateToken.textContent = 'Generating…';

            try {
                const res  = await fetch('/api/admin/generate-token', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    credentials: 'same-origin',
                    body: JSON.stringify({ robloxUsername, discordId, discordUsername })
                });
                const data = await res.json();

                if (data.success) {
                    if (gentokenValue)       gentokenValue.textContent = data.token;
                    if (gentokenUserInfo)    gentokenUserInfo.textContent = `👤 ${data.user.displayName} (@${data.user.username}) — Roblox ID: ${data.user.id}`;
                    if (gentokenExpiresInfo && data.expiresAt) {
                        const exp = new Date(data.expiresAt);
                        gentokenExpiresInfo.textContent = `⏳ Expires: ${exp.toLocaleString()} (30 days)`;
                    }
                    if (gentokenResult) gentokenResult.style.display = 'block';
                    // Clear fields
                    if (gentokenRobloxInput)    gentokenRobloxInput.value    = '';
                    if (gentokenDiscordIdInput) gentokenDiscordIdInput.value = '';
                    if (gentokenDiscordName)    gentokenDiscordName.value    = '';
                } else {
                    if (gentokenError) { gentokenError.textContent = data.message || 'Failed to generate token.'; gentokenError.style.display = 'block'; }
                }
            } catch (e) {
                if (gentokenError) { gentokenError.textContent = 'Network error. Try again.'; gentokenError.style.display = 'block'; }
            }
            btnGenerateToken.disabled = false;
            btnGenerateToken.textContent = 'Generate Token';
        });
    }

    if (gentokenCopyBtn && gentokenValue) {
        gentokenCopyBtn.addEventListener('click', () => {
            const tok = gentokenValue.textContent.trim();
            if (!tok) return;
            navigator.clipboard.writeText(tok).then(() => {
                gentokenCopyBtn.textContent = 'Copied!';
                setTimeout(() => { gentokenCopyBtn.textContent = 'Copy'; }, 2000);
            }).catch(() => {
                // Fallback
                const ta = document.createElement('textarea');
                ta.value = tok;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                gentokenCopyBtn.textContent = 'Copied!';
                setTimeout(() => { gentokenCopyBtn.textContent = 'Copy'; }, 2000);
            });
        });
    }

    /* ── Blocklist Logic ─────────────────────────────────────────── */
    const blockInput = document.getElementById('admin-block-input');
    const btnBlock = document.getElementById('admin-btn-block');
    const blocklistGrid = document.getElementById('admin-blocklist-grid');

    async function fetchBlocklist() {
        if (!blocklistGrid) return;
        try {
            const res = await fetch('/api/admin/blocked', {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                renderBlocklist(data.blocked);
            }
        } catch (e) {
            console.error('Failed to load blocklist', e);
        }
    }

    function renderBlocklist(list) {
        if (!blocklistGrid) return;
        blocklistGrid.innerHTML = '';
        if (list.length === 0) {
            blocklistGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">No blocked users.</div>';
            return;
        }
        list.forEach(item => {
            const isObj = typeof item === 'object' && item !== null;
            const targetId = isObj ? item.userId : item;
            const username = isObj ? item.username : `User #${targetId}`;
            const displayName = isObj ? item.displayName : 'Legacy Block';
            const avatarUrl = (isObj && item.avatarUrl) ? item.avatarUrl : 'https://www.roblox.com/headshot-thumbnail/image?userId=1&width=150&height=150&format=png';

            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'space-between';
            card.style.padding = '0.75rem 1rem';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.borderRadius = '8px';
            card.style.marginBottom = '0.5rem';
            card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); background: #111; object-fit: cover;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-1);">${displayName}</span>
                        <span style="font-size: 0.7rem; color: var(--text-3);">@${username} (ID: ${targetId})</span>
                    </div>
                </div>
                <button class="preview-btn" style="background: var(--danger); font-size: 0.7rem; padding: 0.35rem 0.85rem; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
                    Unblock
                </button>
            `;

            card.querySelector('button').addEventListener('click', async () => {
                try {
                    const res = await fetch('/api/admin/unblock', {
                        method: 'POST',
                        headers: getAdminHeaders(),
                        body: JSON.stringify({ userId: targetId })
                    });
                    const data = await res.json();
                    if (data.success) renderBlocklist(data.blocked);
                } catch (e) { alert('Failed to unblock'); }
            });
            blocklistGrid.appendChild(card);
        });
    }

    /* ── Connected Users Logic ───────────────────────────────────── */
    const sessionsGrid = document.getElementById('admin-sessions-grid');

    async function fetchSessions() {
        if (!sessionsGrid) return;
        try {
            const res = await fetch('/api/admin/sessions', {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                renderSessions(data.sessions);
            }
        } catch (e) {
            console.error('Failed to load active sessions', e);
        }
    }

    function renderSessions(sessions) {
        if (!sessionsGrid) return;
        sessionsGrid.innerHTML = '';
        if (sessions.length === 0) {
            sessionsGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">No connected users.</div>';
            return;
        }
        sessions.forEach(session => {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'space-between';
            card.style.padding = '0.75rem 1rem';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.borderRadius = '8px';
            card.style.marginBottom = '0.5rem';
            card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            const joinedTime = new Date(session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${session.avatarUrl || 'assets/placeholder-roblox.png'}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); background: #111; object-fit: cover;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-1);">${session.displayName}</span>
                        <span style="font-size: 0.7rem; color: var(--text-3);">@${session.username} (ID: ${session.userId})${session.isAdmin ? ' <span style="color: var(--accent); font-weight: bold;">[Admin]</span>' : ''}</span>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 0.2rem;">
                    <span style="font-size: 0.7rem; color: var(--text-3);">Joined: ${joinedTime}</span>
                </div>
            `;
            sessionsGrid.appendChild(card);
        });
    }

    if (btnBlock) {
        btnBlock.addEventListener('click', async () => {
            const userId = blockInput.value.trim();
            if (!userId) return;
            try {
                const res = await fetch('/api/admin/block', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ userId })
                });
                const data = await res.json();
                if (data.success) {
                    blockInput.value = '';
                    renderBlocklist(data.blocked);
                } else {
                    alert(data.message || 'Failed to block user');
                }
            } catch (e) { alert('Failed to block'); }
        });
    }

    /* ── Settings Logic ─────────────────────────────────────────── */
    const adminTsInput = document.getElementById('admin-trading-server-input');
    const btnSaveSettings = document.getElementById('admin-btn-save-settings');

    if (btnSaveSettings && adminTsInput) {
        btnSaveSettings.addEventListener('click', async () => {
            if (!siteData.config) siteData.config = {};
            siteData.config.tradingServerLink = adminTsInput.value.trim();
            
            // Save logic to backend
            await saveData();
            
            // Update the live navigation link immediately
            if (navLinkTradingServer) {
                navLinkTradingServer.href = siteData.config.tradingServerLink;
            }
            
            // Provide a brief visual success confirmation
            const originalText = btnSaveSettings.textContent;
            btnSaveSettings.textContent = 'Saved!';
            btnSaveSettings.style.background = 'var(--success)';
            setTimeout(() => {
                btnSaveSettings.textContent = originalText;
                btnSaveSettings.style.background = '';
            }, 2000);
        });
    }

    /* ─────────────────────────────────────────────────────────
       NAV: Exclusive → slide RIGHT panel into view
    ───────────────────────────────────────────────────────── */
    // (second navLinkExclusive listener removed — now handled above)

    function renderModeratorTiers() {
        const grid = document.getElementById('mod-tiers-grid');
        if (!grid) return;
        grid.innerHTML = '';
        TIER_ITEMS.forEach((tier, i) => {
            const card = makeCard(tier.name, { usd: tier.usd, robux: 'X' }, i, true);
            card.style.alignSelf = 'start'; // Prevent other cards from stretching when this one expands
            // Replace placeholder with the Moderator PNG
            const imgWrap = card.querySelector('.card-img-wrap');
            if (imgWrap) {
                imgWrap.innerHTML = `<img class="item-img mod-tier-img" src="images/Moderator.png" alt="Moderator Tier">`;
            }

            // Add 'See more' button and features list
            const cardBody = card.querySelector('.card-body');
            if (cardBody) {
                const btn = document.createElement('button');
                btn.className = 'see-more-btn';
                btn.textContent = 'See more';
                
                const featuresWrap = document.createElement('div');
                featuresWrap.className = 'tier-features-wrap';
                
                const featuresDiv = document.createElement('div');
                featuresDiv.className = 'tier-features';
                
                function renderList(list) {
                    return `<ul>` + list.map(f => {
                        let btnHtml = '';
                        if (f.preview) {
                            // f.preview is now a direct video path string
                            const videoPath = typeof f.preview === 'string' ? f.preview : null;
                            if (videoPath) {
                                btnHtml = `<button class="preview-btn" data-gif="${videoPath}">Preview</button>`;
                            }
                        }
                        let li = `<li><div class="feature-row"><span>${f.label}</span>${btnHtml}</div>`;
                        if (f.sub) {
                            li += `<ul class="sub-features">` + f.sub.map(sf => {
                                let sBtnHtml = '';
                                if (sf.preview) {
                                    const sVideoPath = typeof sf.preview === 'string' ? sf.preview : null;
                                    if (sVideoPath) {
                                        sBtnHtml = `<button class="preview-btn" data-gif="${sVideoPath}">Preview</button>`;
                                    }
                                }
                                return `<li><div class="feature-row"><span>${sf.label}</span>${sBtnHtml}</div></li>`;
                            }).join('') + `</ul>`;
                        }
                        li += `</li>`;
                        return li;
                    }).join('') + `</ul>`;
                }

                let html = `<h4>${tier.name.split(' (')[0]} Includes</h4>`;
                if (tier.features.inGame.length > 0) {
                    html += `<h5>In-Game</h5>` + renderList(tier.features.inGame);
                }
                if (tier.features.discord.length > 0) {
                    html += `<h5>Discord</h5>` + renderList(tier.features.discord);
                }
                featuresDiv.innerHTML = html;
                featuresWrap.appendChild(featuresDiv);
                
                btn.addEventListener('click', () => {
                    const isExpanded = featuresWrap.classList.toggle('expanded');
                    btn.textContent = isExpanded ? 'See less' : 'See more';
                });

                cardBody.appendChild(btn);
                cardBody.appendChild(featuresWrap);
            }

            grid.appendChild(card);
        });
    }

    /* ── UNDERLINE ────────────────────────────────────────── */
    function setActiveNavLink(view) {
        allNavLinks.forEach(l => l.classList.remove('active'));
        const map = { home: navLinkHome, values: navLinkValues, exclusive: navLinkExclusive, prices: navLinkPrices, admin: navLinkAdmin };
        const el = map[view];
        if (!el) return;
        el.classList.add('active');
        moveUnderline(el);
    }
    function moveUnderline(el) {
        if (!navUnderline || !el) return;
        const container = el.closest('.di-nav') || document.querySelector('.nav-links');
        if (!container) return;
        const cr = container.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        navUnderline.style.left = (er.left - cr.left) + 'px';
        navUnderline.style.width = er.width + 'px';
        navUnderline.style.opacity = '1';
    }
    requestAnimationFrame(() => setActiveNavLink('home'));
    window.addEventListener('resize', () => setActiveNavLink(activeView));

    /* ─────────────────────────────────────────────────────────
       VALUES CATEGORIES
    ───────────────────────────────────────────────────────── */
    function buildValuesCategories() {
        categoryNav.innerHTML = '';
        activeCategory = null;

        // ── Pinned "On Demand" pill ──
        const trendBtn = document.createElement('button');
        trendBtn.className = 'cat-btn cat-btn-trending active';
        trendBtn.id = 'btn-trending';
        trendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="11" height="11" style="margin-right:4px;vertical-align:middle;color:#ff4d6d"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15z"/></svg>On Demand`;
        trendBtn.addEventListener('click', () => {
            document.querySelectorAll('#category-nav .cat-btn').forEach(b => b.classList.remove('active'));
            trendBtn.classList.add('active');
            // Show trending, hide items section
            trendingSection.style.display = '';
            document.getElementById('items-section').style.display = 'none';
            activeCategory = null;
        });
        categoryNav.appendChild(trendBtn);

        // ── Category pills ordered as requested ──
        const categoryOrder = [
            'Double Barrel',
            'Revolver',
            'Tactical',
            'Smg',
            'Silencer',
            'Shotgun',
            'Knifes',
            'Tags',
            'Beams',
            'Books',
            'Items',
            'Frames'
            // Note: Exclusives are intentionally excluded from this page
        ];

        categoryOrder.forEach(name => {
            const cat = siteData.categories[name];
            if (!cat) return;
            if (HIDDEN_CATEGORIES.has(name)) return;

            const items = cat.items || {};
            const itemCount = Object.keys(items).length;

            const btn = document.createElement('button');
            btn.className = 'cat-btn' + (itemCount === 0 ? ' empty' : '');
            btn.textContent = name;
            btn.dataset.cat = name;
            if (itemCount === 0) btn.title = 'No items yet';

            btn.addEventListener('click', () => {
                if (itemCount === 0) return;
                activeCategory = name;
                document.querySelectorAll('#category-nav .cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCategory(name);
            });

            categoryNav.appendChild(btn);
        });
    }

    function renderCategory(catName) {
        const items = (siteData.categories[catName]?.items) || {};
        const list = Object.entries(items);

        // Hide trending when a category is picked
        trendingSection.style.display = 'none';
        document.getElementById('items-section').style.display = '';

        itemsHeader.style.display = '';
        catTitle.textContent = catName;
        countLabel.textContent = `${list.length} skin${list.length !== 1 ? 's' : ''}`;
        itemsGrid.innerHTML = '';

        if (list.length === 0) {
            emptyState.style.display = '';
            emptyState.querySelector('p').textContent = 'No skins in this category yet.';
            return;
        }
        list.forEach(([name, details], i) => itemsGrid.appendChild(makeCard(name, details, i, false, false, catName)));
    }

    /* ─────────────────────────────────────────────────────────
       GLOBAL SEARCH
    ───────────────────────────────────────────────────────── */
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            
            if (!query) {
                if (activeCategory) {
                    // re-activate the button and render
                    document.querySelectorAll('#category-nav .cat-btn').forEach(b => {
                        if (b.dataset.cat === activeCategory) b.classList.add('active');
                    });
                    renderCategory(activeCategory);
                } else {
                    document.getElementById('items-section').style.display = 'none';
                    trendingSection.style.display = '';
                }
                return;
            }

            trendingSection.style.display = 'none';
            document.getElementById('items-section').style.display = '';
            document.querySelectorAll('#category-nav .cat-btn').forEach(b => b.classList.remove('active'));
            activeCategory = null; // deselect category while searching

            itemsHeader.style.display = '';
            catTitle.textContent = `Search: "${e.target.value.trim()}"`;
            itemsGrid.innerHTML = '';
            
            let matches = [];
            Object.entries(siteData.categories || {}).forEach(([catName, cat]) => {
                if (cat.items) {
                    Object.entries(cat.items).forEach(([name, details]) => {
                        const nameLower = name.toLowerCase();
                        if (nameLower.startsWith(query) || nameLower.includes(query)) {
                            // Append category name to distinguish same-named items
                            matches.push({
                                displayName: `${name} (${catName})`,
                                name, 
                                details, 
                                startsWith: nameLower.startsWith(query)
                            });
                        }
                    });
                }
            });
            
            // Sort: items starting with the query appear first
            matches.sort((a, b) => (a.startsWith === b.startsWith) ? 0 : a.startsWith ? -1 : 1);

            countLabel.textContent = `${matches.length} skin${matches.length !== 1 ? 's' : ''} found`;
            
            if (matches.length === 0) {
                itemsGrid.innerHTML = `<div style="text-align:center;grid-column: 1/-1;color:var(--text-3);padding:3rem;">No skins found matching "${e.target.value.trim()}"</div>`;
                return;
            }
            matches.forEach((m, i) => itemsGrid.appendChild(makeCard(m.displayName, m.details, i, false, false, m.displayName.split('(').pop().replace(')','').trim())));
        });
    }

    /* ─────────────────────────────────────────────────────────
       EXCLUSIVE CATEGORIES + ITEMS (right panel)
    ───────────────────────────────────────────────────────── */
    function buildExclusiveCategories() {
        exclCategoryNav.innerHTML = '';

        // "All" pill
        const allBtn = document.createElement('button');
        allBtn.className = 'cat-btn active';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
            document.querySelectorAll('#excl-category-nav .cat-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            renderExclusiveAll();
        });
        exclCategoryNav.appendChild(allBtn);

        Object.entries(siteData.categories).forEach(([name, cat]) => {
            if (HIDDEN_CATEGORIES.has(name)) return;
            if (EXCL_HIDDEN_CATS.has(name)) return;

            const items = cat.items || {};
            const hasExclusive = Object.entries(items).some(
                ([iName, i]) => i.robux === 'X' && !EXCL_HIDDEN_ITEMS.has(iName)
            );
            if (!hasExclusive) return;

            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#excl-category-nav .cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderExclusiveByCategory(name);
            });
            exclCategoryNav.appendChild(btn);
        });
    }

    function renderExclusiveAll() {
        const allItems = collectExclusiveItems(null);
        displayExclusiveItems(allItems, 'Exclusive Items', 'Items that cannot be purchased with Robux');
    }

    function renderExclusiveByCategory(catName) {
        const items = collectExclusiveItems(catName);
        displayExclusiveItems(items, `${catName} Exclusives`, `Browse ${catName.toLowerCase()} exclusive skins`);
    }

    function collectExclusiveItems(filterCat) {
        const result = [];

        // Prepend hardcoded items if viewing All or an appropriate category (e.g. Items/Special)
        // Here we just put them in 'All' view for simplicity
        if (!filterCat) {
            HARDCODED_EXCLUSIVES.forEach(item => {
                result.push({ name: item.name, details: { usd: item.usd, robux: 'X', emoji: item.emoji, customImg: item.customImg }, category: 'Exclusives' });
            });
        }

        Object.entries(siteData.categories).forEach(([catName, cat]) => {
            if (HIDDEN_CATEGORIES.has(catName)) return;
            if (EXCL_HIDDEN_CATS.has(catName)) return;
            if (filterCat && catName !== filterCat) return;

            Object.entries(cat.items || {}).forEach(([name, details]) => {
                if (details.robux === 'X' && !EXCL_HIDDEN_ITEMS.has(name)) {
                    result.push({ name, details, category: catName });
                }
            });
        });

        // Sort by price descending
        function parsePrice(val) {
            if (!val) return 0;
            let clean = val.toString().replace(/\./g, '').replace(/,/g, '').trim();
            let num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }

        result.sort((a, b) => {
            const priceA = parsePrice(a.details.usd);
            const priceB = parsePrice(b.details.usd);
            return priceB - priceA;
        });

        return result;
    }

    function displayExclusiveItems(list, title, subtitle) {
        if (exclCatTitle) exclCatTitle.textContent = title;
        if (exclCountLabel) exclCountLabel.textContent = subtitle ? `${subtitle} • ${list.length} item${list.length !== 1 ? 's' : ''}` : `${list.length} exclusive item${list.length !== 1 ? 's' : ''}`;
        if (exclEmptyState) exclEmptyState.style.display = list.length === 0 ? '' : 'none';
        if (exclItemsGrid) {
            exclItemsGrid.innerHTML = '';
            list.forEach(({ name, details, category }, i) =>
                exclItemsGrid.appendChild(makeCard(name, details, i, true, false, category))
            );
        }
    }

    /* ─────────────────────────────────────────────────────────
       MAKE CARD
       Smart preview: checks availableFiles to show a preview
       button for ANY item that has a matching image/gif/video.
    ───────────────────────────────────────────────────────── */
    function findPreviewFile(name, catName) {
        // Strip out parenthetical suffixes like " (Books)" or " (Knives)" from name
        let cleanName = name.split(' (')[0];
        // Normalise name: lowercase, spaces → dashes
        let n = cleanName.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9\-]/g, '');

        // Normalise/map name to video/image filenames
        const mappings = {
            'bitcoin': 'bitcoin',
            'lighting': 'lightning'
        };
        
        let searchName = mappings[n] || n;

        // Priority: videos first, then gifs, then images
        const videoExts = ['mp4', 'webm', 'mov'];
        const imgExts   = ['gif', 'png', 'jpg', 'jpeg', 'webp'];

        // Books always use videos/
        if (catName === 'Books' || name.includes('(Books)')) {
            const cleanN = searchName.replace('-books-', '-').replace('books-', '');
            for (const ext of videoExts) {
                const matched = availableFiles.videos.find(f => f.toLowerCase() === `${cleanN}.${ext}`);
                if (matched) {
                    return { path: `videos/${matched}`, type: 'video' };
                }
            }
            return null;
        }

        // Check videos folder
        for (const ext of videoExts) {
            const matched = availableFiles.videos.find(f => f.toLowerCase() === `${searchName}.${ext}`);
            if (matched) {
                return { path: `videos/${matched}`, type: 'video' };
            }
        }
        
        // Special-case rename fallback for images/gifs if needed
        if (n === 'bitcoin') {
            searchName = 'bitcoin-knife';
        }

        // Check gifs folder
        for (const ext of imgExts) {
            const matched = availableFiles.gifs.find(f => f.toLowerCase() === `${searchName}.${ext}`);
            if (matched) {
                return { path: `gifs/${matched}`, type: 'image' };
            }
        }
        // Check images folder
        for (const ext of imgExts) {
            const matched = availableFiles.images.find(f => f.toLowerCase() === `${searchName}.${ext}`);
            if (matched) {
                return { path: `images/${matched}`, type: 'image' };
            }
        }
        return null;
    }

    function makeCard(name, details, index, forceExclusive = false, isTrending = false, catName = '') {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.itemName = name.toLowerCase().trim();
        card.style.animationDelay = `${Math.min(index * 0.04, 0.55)}s`;

        // ── Image for the card header ──
        let imgUrl = details.customImg || getEmojiUrl(details.emoji);
        if (!imgUrl) {
            // Check images folder for a card thumbnail
            let n = name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9\-]/g, '');
            const cardImgExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
            for (const ext of cardImgExts) {
                if (availableFiles.images.some(f => f.toLowerCase() === `${n}.${ext}`)) {
                    imgUrl = `images/${n}.${ext}`;
                    break;
                }
            }
        }

        const isExclusive = details.robux === 'X' || forceExclusive;
        const robuxDisplay = (details.robux && details.robux !== 'X') ? `⏣ ${details.robux}` : null;
        const usdDisplay = details.usd ? `$${details.usd}` : null;

        const isModTier = name.startsWith('Tier');

        // Mark exclusive/mod-tier cards so CSS can remove vote-reserved padding
        if (isExclusive || isModTier || forceExclusive) {
            card.classList.add('no-vote');
        }

        // ── Preview button: show if any media file matches this item ──
        let previewBtnHtml = '';
        if (!isModTier && name.toLowerCase() !== 'verified') {
            const preview = findPreviewFile(name, catName);
            if (preview) {
                previewBtnHtml = `<button class="preview-btn card-preview-btn" data-gif="${preview.path}" data-name="${name}">▶ Preview</button>`;
            }
        }

        card.innerHTML = `
            <div class="card-img-wrap">
                ${isTrending ? `<div class="trending-card-badge"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15z"/></svg> Demanded</div>` : ''}
                ${imgUrl ? `<img class="item-img" src="${imgUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` : `<div class="no-img-placeholder">◈</div>`}
            </div>
            <div class="card-body">
                <div class="card-name">${name}</div>
                
                ${isExclusive
                ? `
                   ${previewBtnHtml ? `<div style="width: 100%; margin-bottom: 0.5rem; display: flex; justify-content: center;">${previewBtnHtml}</div>` : ''}
                   <div class="exclusive-price-tag">${usdDisplay || 'N/A'}</div>`
                : `
                    ${previewBtnHtml ? `<div style="margin-bottom:0.3rem">${previewBtnHtml}</div>` : ''}
                    <div class="card-values">
                        <div class="val-chip">
                            <span class="val-label">Robux</span>
                            ${robuxDisplay
                    ? `<span class="val-price">${robuxDisplay}</span>`
                    : `<span class="val-price unavail">Exclusive</span>`}
                        </div>
                        <div class="val-chip">
                            <span class="val-label">USD</span>
                            ${usdDisplay
                    ? `<span class="val-price usd">${usdDisplay}</span>`
                    : `<span class="val-price unavail">N/A</span>`}
                        </div>
                    </div>
                    `
            }
            </div>
        `;

        // ── Voting widget: Overprice / Perfect / Underprice ──
        // Skip for exclusive items (exclusive tab, mod tiers, Verified Wings, Bitcoin, Lightning Beam, etc.)
        if (isExclusive || isModTier || forceExclusive) {
            return card;
        }
        try {
            // Determine category and skin name (handle "Name (Category)" display variants)
            let skinName = name;
            let categoryName = catName || '';
            if ((!categoryName || categoryName === '') && name.includes('(')) {
                const m = name.match(/(.+)\s+\((.+)\)$/);
                if (m) {
                    skinName = m[1].trim();
                    categoryName = m[2].trim();
                }
            }

            const voteHtml = `
                <div class="vote-widget" data-category="${categoryName}" data-skin="${skinName}">
                    <div class="vote-bar" style="display: none;">
                        <div class="vote-bar-fill over" style="width: 0%;"></div>
                        <div class="vote-bar-fill perfect" style="width: 0%;"></div>
                        <div class="vote-bar-fill under" style="width: 0%;"></div>
                    </div>
                    <div class="vote-row">
                        <button class="vote-btn over" data-vote="overprice" title="Overpriced">
                            <span class="vote-icon">▲</span>
                            <span class="vote-label-text">Over</span>
                            <span class="vote-count">0</span>
                        </button>
                        <button class="vote-btn perfect" data-vote="perfect" title="Fair Price">
                            <span class="vote-icon">●</span>
                            <span class="vote-label-text">Fair</span>
                            <span class="vote-count">0</span>
                        </button>
                        <button class="vote-btn under" data-vote="underprice" title="Underpriced">
                            <span class="vote-icon">▼</span>
                            <span class="vote-label-text">Under</span>
                            <span class="vote-count">0</span>
                        </button>
                    </div>
                </div>
            `;

            const wrap = document.createElement('div');
            wrap.innerHTML = voteHtml;
            const vw = wrap.firstElementChild;
            card.querySelector('.card-body').appendChild(vw);

            // Helper to update UI counts & active state
            function updateVotesUI(data) {
                if (!data || !vw) return;
                if (!data.success && data.message && data.message.toLowerCase().includes('disabled')) {
                    // remove widget when votes are disabled on production
                    vw.remove();
                    return;
                }
                const counts = data.counts || { overprice: 0, perfect: 0, underprice: 0 };
                
                // Update distribution bar
                const total = (counts.overprice || 0) + (counts.perfect || 0) + (counts.underprice || 0);
                const bar = vw.querySelector('.vote-bar');
                if (total > 0 && bar) {
                    bar.style.display = 'flex';
                    vw.querySelector('.vote-bar-fill.over').style.width = (((counts.overprice || 0) / total) * 100) + '%';
                    vw.querySelector('.vote-bar-fill.perfect').style.width = (((counts.perfect || 0) / total) * 100) + '%';
                    vw.querySelector('.vote-bar-fill.under').style.width = (((counts.underprice || 0) / total) * 100) + '%';
                } else if (bar) {
                    bar.style.display = 'none';
                }

                vw.querySelectorAll('.vote-btn').forEach(btn => {
                    const v = btn.getAttribute('data-vote');
                    const span = btn.querySelector('.vote-count');
                    if (span) span.textContent = (counts[v] || 0).toString();
                    btn.classList.toggle('active', data.userVote === v);
                });
            }

            // Fetch initial counts
            (async () => {
                try {
                    const q = new URLSearchParams({ category: categoryName, skinName: skinName });
                    const res = await fetch('/api/votes?' + q.toString(), { credentials: 'same-origin' });
                    const data = await res.json();
                    if (data && data.success) updateVotesUI(data);
                } catch (e) { /* ignore */ }
            })();

            // Click handlers
            vw.querySelectorAll('.vote-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const selected = btn.getAttribute('data-vote');
                    const token = localStorage.getItem('hc_session_token') || '';
                    if (!token) {
                        alert('Please connect your Roblox account to vote.');
                        const btnConnect = document.getElementById('connect-roblox-btn');
                        if (btnConnect) btnConnect.click();
                        return;
                    }

                    // Optimistic UI: highlight selected immediately and disable buttons
                    vw.querySelectorAll('.vote-btn').forEach(b => b.disabled = true);
                    vw.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    try {
                        const body = { category: categoryName, skinName: skinName, vote: selected };
                        const r = await fetch('/api/vote', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-session-token': token
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify(body)
                        });
                        const text = await r.text();
                        let j = null;
                        try {
                            j = JSON.parse(text);
                        } catch (parseErr) {
                            throw new Error(`Unexpected server response: ${text.trim().slice(0, 200)}`);
                        }
                        if (j && j.success) {
                            updateVotesUI(j);
                        } else if (j && j.message && j.message.toLowerCase().includes('disabled')) {
                            // remove widget silently when server disables votes
                            vw.remove();
                        } else {
                            // revert optimistic highlight on failure
                            vw.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
                            alert((j && j.message) || 'Failed to submit vote.');
                        }
                    } catch (err) {
                        console.error('Vote error', err);
                        vw.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
                        alert('Failed to submit vote. ' + (err.message || '')); 
                    } finally {
                        vw.querySelectorAll('.vote-btn').forEach(b => b.disabled = false);
                    }
                });
            });
        } catch (err) {
            console.error('Failed to init vote widget', err);
        }
        return card;
    }

    /* ── EMOJI → CDN URL ──────────────────────────────────── */
    function getEmojiUrl(emojiString) {
        if (!emojiString) return null;
        const match = emojiString.match(/<(a)?:[^:]+:(\d+)>/);
        if (match) {
            const ext = match[1] ? 'gif' : 'webp';
            return `https://cdn.discordapp.com/emojis/${match[2]}.${ext}?size=256&quality=lossless`;
        }
        return null;
    }

    /* ── GIF PREVIEW MODAL ────────────────────────────────────────── */
    document.addEventListener('click', e => {
        if (e.target.classList.contains('preview-btn')) {
            const gifUrl = e.target.getAttribute('data-gif');
            const itemName = e.target.getAttribute('data-name') || 'preview';
            showPreviewModal(gifUrl, itemName);
        }
    });

    let previewModal = null;
    let previewMedia = null;

    function showPreviewModal(url, name = 'preview') {
        if (!previewModal) {
            previewModal = document.createElement('div');
            previewModal.className = 'preview-modal';
            document.body.appendChild(previewModal);
            
            previewModal.addEventListener('click', () => {
                previewModal.classList.remove('active');
                
                // Instantly pause video so sound stops during fade out
                const videoEl = previewModal.querySelector('video');
                if (videoEl) {
                    videoEl.pause();
                    videoEl.src = '';
                }

                setTimeout(() => { 
                    previewModal.style.display = 'none'; 
                    previewModal.innerHTML = ''; // Destroy elements completely
                }, 300);
            });
        }
        
        if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
            previewModal.innerHTML = `
                <div class="video-container" style="position: relative; display: flex; align-items: center; justify-content: center; max-width: 95%; max-height: 85vh;">
                    <video class="preview-modal-img" src="${url}" autoplay loop playsinline onclick="event.stopPropagation()"></video>
                    <div class="video-spinner" style="position: absolute; width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; pointer-events: none; display: none;"></div>
                </div>
                <div class="close-hint">Click outside the video to close</div>
            `;
            const videoEl = previewModal.querySelector('video');
            const spinnerEl = previewModal.querySelector('.video-spinner');
            
            if (videoEl && spinnerEl) {
                videoEl.addEventListener('loadstart', () => { spinnerEl.style.display = 'block'; });
                videoEl.addEventListener('waiting', () => { spinnerEl.style.display = 'block'; });
                videoEl.addEventListener('canplay', () => { spinnerEl.style.display = 'none'; });
                videoEl.addEventListener('playing', () => { spinnerEl.style.display = 'none'; });
                videoEl.addEventListener('error', () => { spinnerEl.style.display = 'none'; });
            }
        } else {
            previewModal.innerHTML = `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; max-width: 95%; max-height: 85vh;">
                    <img class="preview-modal-img" src="${url}" alt="Preview" onclick="event.stopPropagation()" draggable="false">
                </div>
                <div class="close-hint">Click outside the image to close</div>
            `;
        }
        
        previewModal.style.display = 'flex';
        // force reflow for transition
        void previewModal.offsetWidth;
        previewModal.classList.add('active');
    }

    /* ─────────────────────────────────────────────────────────
       ROBLOX CONNECT & USER SESSION LOGIC
       (DOM refs were moved earlier to avoid TDZ on refresh)
       ───────────────────────────────────────────────────────── */
    const modalCloseBtn = document.getElementById('roblox-modal-close');

    function getApiUrl(path) {
        // Use the current domain so it works both locally and via Cloudflare Tunnel on mobile/web
        return `${window.location.origin}${path}`;
    }

    async function logoutUser() {
        const token = localStorage.getItem('hc_session_token');
        if (token) {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ token })
                });
            } catch (err) {
                console.error('Logout failed', err);
            }
        }

        localStorage.removeItem('roblox_user');
        localStorage.removeItem('hc_session_token');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('dev_key');
        if (navLinkAdmin) navLinkAdmin.style.display = 'none'; // hide Admin view link
        goLeft('home'); // securely redirect to home view
        populateDICentre(false, false);
        renderUserNavbar();
        
        // Hide page wrapper and dynamic island, and display the connect modal
        document.getElementById('page-wrapper').style.display = 'none';
        document.getElementById('dynamic-island').style.display = 'none';
        const modalCloseBtnEl = document.getElementById('roblox-modal-close');
        if (modalCloseBtnEl) modalCloseBtnEl.style.display = 'none';
        openConnectModal();
    }

    function renderUserNavbar(discordInfo = lastDiscordData) {
        const savedUserJson = localStorage.getItem('roblox_user');
        if (savedUserJson) {
            const user = JSON.parse(savedUserJson);
            // mark admin state on body for conditional UI (shows vote counts to admin)
            document.body.classList.toggle('is-admin', !!user.isAdmin);

            let discordBadgeHtml = '';
            if (discordInfo && discordInfo.connected && discordInfo.discordUsername) {
                discordBadgeHtml = `
                    <div class="roblox-verified-badge discord-badge" style="margin-top: 0.25rem; color: #5865F2;">
                        <svg width="12" height="12" viewBox="0 0 127.14 96.36" fill="currentColor">
                            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91.08,65.69,84.69,65.69Z"/>
                        </svg> @${discordInfo.discordUsername}
                    </div>
                `;
            }

            navUserArea.innerHTML = `
                <button class="donation-nav-btn" id="donation-open-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    Donate
                </button>
                <div class="user-profile-widget" id="user-profile-widget">
                    <div class="user-avatar-ring">
                        <img class="user-avatar-img" src="${user.avatarUrl || 'shield.png'}" alt="${user.displayName}">
                    </div>
                    <div class="user-info-text">
                        <span class="user-display-name">${user.displayName}</span>
                        <span class="user-username">@${user.username}</span>
                    </div>
                    <span class="user-dropdown-arrow">&#9662;</span>
                    
                    <div class="user-dropdown-menu" id="user-dropdown-menu">
                        <img class="user-dropdown-avatar" src="${user.avatarUrl || 'shield.png'}" alt="Avatar">
                        <div class="user-dropdown-name-wrap">
                            <div class="user-dropdown-display-name">${user.displayName}</div>
                            <div class="user-dropdown-username">@${user.username}</div>
                            <div class="roblox-verified-badge">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                    <path d="M20 6L9 17l-5-5"></path>
                                </svg> Verified User
                            </div>
                            ${discordBadgeHtml}
                        </div>
                        <a href="https://www.roblox.com/users/${user.id}/profile" target="_blank" class="user-dropdown-btn primary">View Roblox Profile</a>
                        <button id="roblox-btn-logout" class="user-dropdown-btn danger">Disconnect Account</button>
                    </div>
                </div>
            `;
            
            // Wire up Donation button
            const donateBtn = document.getElementById('donation-open-btn');
            if (donateBtn) donateBtn.addEventListener('click', (e) => { e.stopPropagation(); openDonationModal(); });

            const widget = document.getElementById('user-profile-widget');
            const dropdown = document.getElementById('user-dropdown-menu');
            
            if (widget && dropdown) {
                // Click toggles the big profile card (works on desktop + mobile)
                widget.addEventListener('click', (e) => {
                    if (e.target.closest('#user-dropdown-menu')) return;
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                });
                // Clicking inside the card doesn't close it
                dropdown.addEventListener('click', (e) => e.stopPropagation());
            }
            
            const logoutBtn = document.getElementById('roblox-btn-logout');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await logoutUser();
                });
            }
            
            // Click anywhere else closes the card
            document.addEventListener('click', () => {
                if (dropdown) dropdown.classList.remove('active');
            });
        } else {
            navUserArea.innerHTML = `
                <button class="connect-roblox-btn" id="connect-roblox-btn">
                    <svg viewBox="0 0 24 24">
                        <path d="M18.8,19.9L5.3,16.3L8.9,2.8L22.4,6.4L18.8,19.9z M12.1,8.3l-2,7.3l5.5,1.5l2-7.3L12.1,8.3z" />
                    </svg>
                    <span>Connect Roblox</span>
                </button>
            `;
            
            const btnConnect = document.getElementById('connect-roblox-btn');
            if (btnConnect) {
                btnConnect.addEventListener('click', () => {
                    openConnectModal();
                });
            }
        }
    }

    /**
     * Populate the Dynamic Island centre zone based on access flags.
     * @param {boolean} isAdmin  - user has admin access
     * @param {boolean} hasPrices - user has prices access
     */
    function populateDICentre(isAdmin, hasPrices) {
        const centre = document.getElementById('di-centre');
        if (!centre) return;
        centre.innerHTML = '';
        centre.classList.remove('has-both', 'revealed');

        if (!isAdmin && !hasPrices) return; // nothing to show

        if (isAdmin && hasPrices) {
            // Both: show Admin by default, reveal Price on hover/tap
            centre.classList.add('has-both');

            const adminBtn = document.createElement('button');
            adminBtn.className = 'di-admin-btn';
            adminBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg> Admin View`;
            adminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetValuesToTrending();
                setView('admin');
            });
            // Mobile tap: toggle price reveal
            adminBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                centre.classList.toggle('revealed');
            }, { passive: false });

            const priceBtn = document.createElement('button');
            priceBtn.className = 'di-price-btn';
            priceBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> Prices`;
            priceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                centre.classList.remove('revealed');
                resetValuesToTrending();
                setView('prices');
            });

            centre.appendChild(adminBtn);
            centre.appendChild(priceBtn);

        } else if (isAdmin) {
            // Admin only
            const adminBtn = document.createElement('button');
            adminBtn.className = 'di-admin-btn';
            adminBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg> Admin View`;
            adminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetValuesToTrending();
                setView('admin');
            });
            centre.appendChild(adminBtn);

        } else if (hasPrices) {
            // Prices only
            const priceBtn = document.createElement('button');
            priceBtn.className = 'di-price-btn';
            priceBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> Prices`;
            priceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetValuesToTrending();
                setView('prices');
            });
            centre.appendChild(priceBtn);
        }
    }

    function openConnectModal() {
        AuthWizard.open(1);
    }

    function closeConnectModal() {
        // Auth wizard is mandatory; closing is managed programmatically by AuthWizard.close()
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeConnectModal);

    async function handleRobloxLookup() {
        console.log("handleRobloxLookup called");
        const username = usernameInput.value.trim();
        if (!username) {
            console.warn("handleRobloxLookup: username is empty");
            showError("Please enter your Roblox username.");
            return;
        }
        
        console.log("Resolving Roblox user:", username);
        modalError.style.display = 'none';
        stepInput.style.display = 'none';
        stepLoading.style.display = 'flex';
        
        try {
            const url = getApiUrl(`/api/roblox/resolve?username=${encodeURIComponent(username)}`);
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                resolvedUser = data;
                
                // Generate a three-word verification phrase from server-side whitelist
                let verificationPhrase = null;
                try {
                    const wordsRes = await fetch(getApiUrl('/api/verify-words'));
                    const wordsList = await wordsRes.json();
                    if (Array.isArray(wordsList) && wordsList.length >= 3) {
                        const pick = new Set();
                        while (pick.size < 3) {
                            const w = wordsList[Math.floor(Math.random() * wordsList.length)];
                            if (w && typeof w === 'string') pick.add(w);
                        }
                        verificationPhrase = Array.from(pick).join(' ');
                    }
                } catch (e) {
                    console.warn('Failed to fetch verify words, falling back to alphanumeric code', e);
                }

                if (!verificationPhrase) {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    let code = '';
                    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                    verificationPhrase = `HC-${code}`;
                }
                // normalize display
                verificationPhrase = String(verificationPhrase).toUpperCase();
                
                // Set elements
                document.getElementById('roblox-phrase-text').textContent = verificationPhrase;
                resultAvatar.src = data.avatarUrl || 'shield.png';
                resultDisplayName.textContent = data.displayName;
                resultUsername.textContent = `@${data.username}`;
                
                // Reset verify error
                const verifyError = document.getElementById('roblox-verify-error');
                if (verifyError) {
                    verifyError.textContent = '';
                    verifyError.style.display = 'none';
                }
                
                stepLoading.style.display = 'none';
                stepResult.style.display = 'flex';
            } else {
                showError(data.message || 'Roblox user not found.');
            }
        } catch (err) {
            showError('Unable to connect to server: ' + err.message + '. Please ensure the server is running on port 8000.');
        }
    }

    function showError(msg) {
        modalError.textContent = msg;
        modalError.style.display = 'block';
        stepLoading.style.display = 'none';
        stepInput.style.display = 'block';
    }

    if (btnSearch) {
        console.log("Found roblox-btn-search element, attaching click listener");
        btnSearch.addEventListener('click', (e) => {
            console.log("Connect button click event captured");
            handleRobloxLookup();
        });
    } else {
        console.error("Could not find roblox-btn-search element in the DOM");
    }
    
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log("Enter key pressed in Roblox username input");
                handleRobloxLookup();
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            stepResult.style.display = 'none';
            stepInput.style.display = 'block';
            usernameInput.value = '';
            resolvedUser = null;
        });
    }

    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            if (!resolvedUser) return;
            
            const phraseText = document.getElementById('roblox-phrase-text').textContent;
            const verifyError = document.getElementById('roblox-verify-error');
            
            btnConfirm.disabled = true;
            const origBtnText = btnConfirm.textContent;
            btnConfirm.textContent = 'Verifying...';
            if (verifyError) verifyError.style.display = 'none';
            
            try {
                const url = getApiUrl(`/api/roblox/verify?userId=${resolvedUser.id}&phrase=${encodeURIComponent(phraseText)}`);
                const response = await fetch(url);
                const data = await response.json();
                if (data.success && data.verified) {
                    resolvedUser.loginTime = Date.now();
                    localStorage.setItem('roblox_user', JSON.stringify(resolvedUser));
                    
                    if (data.userToken) {
                        localStorage.setItem('hc_session_token', data.userToken);
                    }
                    if (data.adminToken) {
                        localStorage.setItem('admin_token', data.adminToken);
                    }
                    
                    goLeft('home'); // FORCE START ON HOME SITE

                    // Grant Dev Access only if server confirms admin
                    if (data.isAdmin) {
                        localStorage.setItem('dev_key', 'roblox_verified');
                        navLinkAdmin.style.display = 'inline-block';
                    } else {
                        localStorage.removeItem('dev_key');
                        navLinkAdmin.style.display = 'none';
                    }
                    await initializeSession();
                } else {
                    if (verifyError) {
                        verifyError.textContent = data.message || 'Verification failed. Please check your Roblox bio description.';
                        verifyError.style.display = 'block';
                        verifyError.style.animation = 'none';
                        void verifyError.offsetWidth; // trigger reflow
                        verifyError.style.animation = 'shake 0.4s ease';
                    }
                }
            } catch (err) {
                if (verifyError) {
                    verifyError.textContent = 'Error connecting to server: ' + err.message;
                    verifyError.style.display = 'block';
                }
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.textContent = origBtnText;
            }
        });
    }

    const btnCopy = document.getElementById('roblox-btn-copy');
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const phraseText = document.getElementById('roblox-phrase-text').textContent;
            navigator.clipboard.writeText(phraseText).then(() => {
                const orig = btnCopy.innerHTML;
                btnCopy.innerHTML = '✓ Copied';
                btnCopy.style.background = 'var(--success)';
                btnCopy.style.color = '#fff';
                setTimeout(() => {
                    btnCopy.innerHTML = orig;
                    btnCopy.style.background = '';
                    btnCopy.style.color = '';
                }, 1500);
            });
        });
    }

    /* ─────────────────────────────────────────────────────────
       AUTH WIZARD + DISCORD VERIFICATION & SERVER MEMBERSHIP LOGIC
    ───────────────────────────────────────────────────────── */

    // Expose wizard on btnConnectDiscordOauth and btnJoinDiscordServer via their existing IDs
    const btnConnectDiscordOauth = document.getElementById('btn-connect-discord-oauth');
    const btnJoinDiscordServer   = document.getElementById('btn-join-discord-server');
    const btnCheckDiscordMember  = document.getElementById('btn-check-discord-membership');

    let discordPollInterval = null;

    function stopDiscordPolling() {
        if (discordPollInterval) {
            clearInterval(discordPollInterval);
            discordPollInterval = null;
        }
    }

    async function fetchAndPopulateServerCard(inviteLink) {
        const serverNameEl      = document.getElementById('join-discord-server-name');
        const serverMetaEl      = document.getElementById('join-discord-server-meta-text');
        const serverIconEl      = document.getElementById('join-discord-server-icon');
        const serverIconFallbackEl = document.getElementById('join-discord-server-icon-fallback');

        let code = null;
        if (inviteLink) {
            const m = inviteLink.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/i);
            if (m && m[1]) code = m[1];
        }
        if (!code) return;

        try {
            const res  = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
            const json = await res.json();
            if (json && json.guild) {
                const guild    = json.guild;
                const name     = guild.name || 'Discord Server';
                const online   = json.approximate_presence_count || null;
                const members  = json.approximate_member_count  || null;
                const iconHash = guild.icon;
                const iconUrl  = iconHash
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${iconHash}.${iconHash.startsWith('a_') ? 'gif' : 'png'}?size=64`
                    : null;

                if (serverNameEl) serverNameEl.textContent = name;

                if (serverMetaEl) {
                    const onlineStr  = online  ? `${online.toLocaleString()} Online • ` : '';
                    const memberStr  = members ? `${members.toLocaleString()} Members`   : 'Official Discord Server';
                    serverMetaEl.textContent = `${onlineStr}${memberStr}`;
                }

                if (serverIconEl && serverIconFallbackEl) {
                    if (iconUrl) {
                        serverIconEl.src          = iconUrl;
                        serverIconEl.style.display = 'block';
                        serverIconFallbackEl.style.display = 'none';
                    } else {
                        serverIconEl.style.display          = 'none';
                        serverIconFallbackEl.style.display  = 'flex';
                    }
                }
            }
        } catch (e) {
            console.warn('Could not fetch Discord server info:', e);
        }
    }

    function updateDiscordJoinModalUI(discord) {
        if (!discord) return;

        const dAvatar = document.getElementById('join-discord-user-avatar');
        const dName   = document.getElementById('join-discord-user-name');
        if (dAvatar && discord.discordAvatar)   dAvatar.src         = discord.discordAvatar;
        if (dName   && discord.discordUsername) dName.textContent   = `@${discord.discordUsername}`;

        const inviteLink = discord.inviteLink || (btnJoinDiscordServer && btnJoinDiscordServer.href) || null;
        if (btnJoinDiscordServer && discord.inviteLink) {
            btnJoinDiscordServer.href = discord.inviteLink;
        }
        if (inviteLink) fetchAndPopulateServerCard(inviteLink);

        const badgeEl = document.getElementById('join-discord-membership-badge');
        if (badgeEl) {
            if (discord.inServer) {
                badgeEl.className = 'discord-status-badge joined';
                badgeEl.innerHTML = '<span class="badge-icon">✅</span> Joined Server';
            } else {
                badgeEl.className = 'discord-status-badge unjoined';
                badgeEl.innerHTML = '<span class="badge-icon">❌</span> Invalid';
            }
        }
    }

    function handleDiscordGating(discord, user) {
        // Discord disabled → unlock site immediately
        if (!discord || !discord.enabled) {
            stopDiscordPolling();
            AuthWizard.close();
            document.getElementById('page-wrapper').style.display = 'block';
            document.getElementById('dynamic-island').style.display = 'flex';
            return true;
        }

        // Step 2: Discord not yet connected
        if (!discord.connected) {
            stopDiscordPolling();
            document.getElementById('page-wrapper').style.display = 'none';
            document.getElementById('dynamic-island').style.display = 'none';

            AuthWizard.open(2, user, discord);
            return false;
        }

        // Step 3: Not yet in server
        if (!discord.inServer) {
            document.getElementById('page-wrapper').style.display = 'none';
            document.getElementById('dynamic-island').style.display = 'none';

            AuthWizard.open(3, user, discord);

            if (!discordPollInterval) {
                discordPollInterval = setInterval(checkDiscordMembershipNow, 5000);
            }
            return false;
        }

        // All steps complete → close wizard, show site
        stopDiscordPolling();
        AuthWizard.close();
        document.getElementById('page-wrapper').style.display = 'block';
        document.getElementById('dynamic-island').style.display = 'flex';
        return true;
    }

    async function checkDiscordMembershipNow() {
        const token = localStorage.getItem('hc_session_token');
        if (!token) return;
        try {
            const res = await fetch(getApiUrl('/api/discord/check-membership'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': token
                },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            if (data.success) {
                if (data.connected && data.inServer) {
                    stopDiscordPolling();
                    AuthWizard.close();
                    document.getElementById('page-wrapper').style.display = 'block';
                    document.getElementById('dynamic-island').style.display = 'flex';
                } else if (!data.connected) {
                    stopDiscordPolling();
                    initializeSession();
                }
            }
        } catch (e) {
            console.warn('Membership check error:', e);
        }
    }

    if (btnCheckDiscordMember) {
        btnCheckDiscordMember.addEventListener('click', async () => {
            btnCheckDiscordMember.disabled = true;
            btnCheckDiscordMember.classList.add('checking');
            const spanEl = btnCheckDiscordMember.querySelector('span');
            const orig = spanEl ? spanEl.textContent : btnCheckDiscordMember.textContent;
            if (spanEl) spanEl.textContent = 'Checking...';
            await checkDiscordMembershipNow();
            setTimeout(() => {
                btnCheckDiscordMember.disabled = false;
                btnCheckDiscordMember.classList.remove('checking');
                if (spanEl) spanEl.textContent = orig;
            }, 600);
        });
    }

    async function initAdminDiscordSettings() {
        const enabledCb = document.getElementById('admin-discord-enabled-checkbox');
        const guildInp  = document.getElementById('admin-discord-guild-id-input');
        const linkInp   = document.getElementById('admin-discord-invite-link-input');
        const envStatus = document.getElementById('admin-discord-env-status');
        const saveBtn   = document.getElementById('admin-btn-save-discord-settings');

        if (!guildInp || !linkInp || !saveBtn) return;

        try {
            const res = await fetch(getApiUrl('/api/admin/discord-settings'), {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success && data.settings) {
                if (enabledCb) enabledCb.checked = !!data.settings.enabled;
                guildInp.value = data.settings.guildId || '';
                linkInp.value  = data.settings.inviteLink || '';

                if (envStatus && data.envStatus) {
                    const cid = data.envStatus.clientIdConfigured ? '<span style="color:var(--success);font-weight:bold;">Set</span>' : '<span style="color:var(--danger);">Missing</span>';
                    const csec = data.envStatus.clientSecretConfigured ? '<span style="color:var(--success);font-weight:bold;">Set</span>' : '<span style="color:var(--danger);">Missing</span>';
                    const bot = data.envStatus.botTokenConfigured ? '<span style="color:var(--success);font-weight:bold;">Set (Optional)</span>' : '<span style="color:var(--text-3);">Not Set (Optional)</span>';
                    envStatus.innerHTML = `
                        <strong>Discord OAuth Credentials (.env status):</strong><br>
                        • DISCORD_CLIENT_ID: ${cid}<br>
                        • DISCORD_CLIENT_SECRET: ${csec}<br>
                        • DISCORD_BOT_TOKEN: ${bot}
                    `;
                }
            }
        } catch (e) {
            console.error('Failed to load admin discord settings', e);
        }

        saveBtn.addEventListener('click', async () => {
            const enabled = enabledCb ? enabledCb.checked : true;
            const guildId = guildInp.value.trim();
            const inviteLink = linkInp.value.trim();

            const origText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                const res = await fetch(getApiUrl('/api/admin/discord-settings'), {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ enabled, guildId, inviteLink })
                });
                const data = await res.json();
                if (data.success) {
                    saveBtn.textContent = 'Saved!';
                    saveBtn.style.background = 'var(--success)';
                    setTimeout(() => {
                        saveBtn.textContent = origText;
                        saveBtn.style.background = '';
                        saveBtn.disabled = false;
                    }, 1500);
                } else {
                    alert(data.message || 'Failed to save Discord settings.');
                    saveBtn.textContent = origText;
                    saveBtn.disabled = false;
                }
            } catch (e) {
                alert('Error saving settings: ' + e.message);
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
            }
        });
    }

    /* ── Prices Access check logic ────────────────────────────────── */
    async function checkPricesAccess() {
        const sessionToken = localStorage.getItem('hc_session_token');
        const adminToken = localStorage.getItem('admin_token');
        const navLinkPrices = document.getElementById('navlink-prices');
        
        if (!sessionToken) {
            if (navLinkPrices) navLinkPrices.style.display = 'none';
            return { allowed: false, isAdmin: false };
        }
        
        try {
            const res = await fetch('/api/prices/check', {
                headers: {
                    'x-session-token': sessionToken,
                    'x-admin-token': adminToken || ''
                }
            });
            const data = await res.json();
            
            if (data.success && data.allowed) {
                if (navLinkPrices) navLinkPrices.style.display = 'inline-block';
                return data;
            } else {
                if (navLinkPrices) navLinkPrices.style.display = 'none';
                // If they are on the prices view but lost access, kick them out instantly
                if (activeView === 'prices') {
                    alert('Your access to Prices has been revoked.');
                    setView('home');
                }
                return { allowed: false, isAdmin: false };
            }
        } catch (e) {
            console.error('Failed to check prices access:', e);
            if (navLinkPrices) navLinkPrices.style.display = 'none';
            return { allowed: false, isAdmin: false };
        }
    }

    async function refreshPricesView() {
        const access = await checkPricesAccess();
        if (!access.allowed) return; // checkPricesAccess will redirect to home if activeView === 'prices'
        
        // Load suggestions
        fetchSuggestions(access.isAdmin);
    }


    // ── "See Who" floating hover panel ──────────────────────────────────────
    // Build the panel element once and append it to <body> so it is never
    // clipped by an ancestor's overflow:hidden.
    const _seeWhoPanel = (function () {
        const panel = document.createElement('div');
        panel.id = 'whitelist-hover-panel';
        panel.innerHTML = `
            <span class="tooltip-title">Price Access Users</span>
            <div class="tooltip-list" id="whitelist-tooltip-list">
                <div class="tooltip-loading">Loading...</div>
            </div>`;
        document.body.appendChild(panel);
        return panel;
    })();

    // Position the panel centred above the trigger button
    function _positionSeeWhoPanel(btn) {
        const r = btn.getBoundingClientRect();
        const panelW = _seeWhoPanel.offsetWidth || 260;
        let left = r.left + r.width / 2 - panelW / 2;
        // Keep inside viewport
        left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
        const top = r.top - _seeWhoPanel.offsetHeight - 10;
        _seeWhoPanel.style.left = left + 'px';
        _seeWhoPanel.style.top  = top  + 'px';
    }

    let _seeWhoLeaveTimer = null;

    function _showSeeWhoPanel(btn) {
        clearTimeout(_seeWhoLeaveTimer);
        _positionSeeWhoPanel(btn);
        _seeWhoPanel.classList.add('visible');
    }

    function _hideSeeWhoPanel() {
        _seeWhoLeaveTimer = setTimeout(() => {
            _seeWhoPanel.classList.remove('visible');
        }, 120);
    }

    // Wire hover events
    function _initSeeWhoHover() {
        const btn = document.getElementById('see-more-whitelist-btn');
        if (!btn) return;

        btn.addEventListener('mouseenter', () => _showSeeWhoPanel(btn));
        btn.addEventListener('mouseleave', _hideSeeWhoPanel);

        _seeWhoPanel.addEventListener('mouseenter', () => clearTimeout(_seeWhoLeaveTimer));
        _seeWhoPanel.addEventListener('mouseleave', _hideSeeWhoPanel);

        // Re-position on scroll / resize so the panel follows the button
        window.addEventListener('scroll', () => {
            if (_seeWhoPanel.classList.contains('visible')) _positionSeeWhoPanel(btn);
        }, { passive: true });
        window.addEventListener('resize', () => {
            if (_seeWhoPanel.classList.contains('visible')) _positionSeeWhoPanel(btn);
        }, { passive: true });
    }

    async function loadPublicWhitelist() {
        const tooltipList = document.getElementById('whitelist-tooltip-list');
        const sidebarGrid = document.getElementById('prices-access-list-grid');

        _initSeeWhoHover();

        try {
            const res = await fetch('/api/prices/public-whitelist');
            const data = await res.json();
            if (data.success && data.whitelist) {
                renderPublicWhitelistTooltip(data.whitelist);
                renderInsiderWhitelistPanel(data.whitelist);
            } else {
                if (tooltipList) tooltipList.innerHTML = '<div class="tooltip-loading">Failed to load users</div>';
                if (sidebarGrid) sidebarGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">Failed to load users</div>';
            }
        } catch (e) {
            console.error('Failed to load public whitelist', e);
            if (tooltipList) tooltipList.innerHTML = '<div class="tooltip-loading">Error loading users</div>';
            if (sidebarGrid) sidebarGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">Error loading users</div>';
        }
    }

    function renderPublicWhitelistTooltip(list) {
        const tooltipList = document.getElementById('whitelist-tooltip-list');
        if (!tooltipList) return;
        tooltipList.innerHTML = '';

        if (list.length === 0) {
            tooltipList.innerHTML = '<div class="tooltip-loading">No whitelisted users</div>';

            return;
        }

        list.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'tooltip-user-item';

            const img = document.createElement('img');
            img.src = item.avatarUrl || 'assets/placeholder-roblox.png';
            img.className = 'tooltip-avatar';

            const names = document.createElement('div');
            names.className = 'tooltip-names';

            const dispName = document.createElement('span');
            dispName.className = 'tooltip-display-name';
            dispName.textContent = item.displayName;

            const uName = document.createElement('span');
            uName.className = 'tooltip-username';
            uName.textContent = `@${item.username}`;

            names.appendChild(dispName);
            names.appendChild(uName);
            itemEl.appendChild(img);
            itemEl.appendChild(names);
            tooltipList.appendChild(itemEl);
        });
    }

    function renderInsiderWhitelistPanel(list) {
        const sidebarGrid = document.getElementById('prices-access-list-grid');
        if (!sidebarGrid) return;
        sidebarGrid.innerHTML = '';

        if (list.length === 0) {
            sidebarGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">No users with access.</div>';
            return;
        }

        list.forEach(item => {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '0.75rem';
            card.style.padding = '0.75rem 1rem';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.borderRadius = '8px';
            card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            const img = document.createElement('img');
            img.src = item.avatarUrl || 'assets/placeholder-roblox.png';
            img.alt = item.displayName;
            img.style.width = '36px';
            img.style.height = '36px';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            img.style.background = 'rgba(255, 255, 255, 0.05)';

            const info = document.createElement('div');
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            info.style.gap = '0.1rem';

            const displayNameEl = document.createElement('div');
            displayNameEl.textContent = item.displayName;
            displayNameEl.style.fontWeight = '600';
            displayNameEl.style.fontSize = '0.9rem';
            displayNameEl.style.color = 'var(--text-1)';

            const usernameEl = document.createElement('div');
            usernameEl.textContent = `@${item.username}`;
            usernameEl.style.fontSize = '0.75rem';
            usernameEl.style.color = 'var(--text-2)';

            info.appendChild(displayNameEl);
            info.appendChild(usernameEl);

            card.appendChild(img);
            card.appendChild(info);
            sidebarGrid.appendChild(card);
        });
    }


    /* ── Prices Whitelist Manager UI (Admin View) ─────────────────── */
    const pricesInput = document.getElementById('admin-prices-input');
    const btnAddPrices = document.getElementById('admin-btn-add-prices');
    const pricesWhitelistGrid = document.getElementById('admin-prices-whitelist-grid');

    async function fetchPricesWhitelist() {
        if (!pricesWhitelistGrid) return;
        try {
            const res = await fetch('/api/prices/whitelist', {
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                renderPricesWhitelist(data.whitelist);
            }
        } catch (e) {
            console.error('Failed to load prices whitelist', e);
        }
    }

    function renderPricesWhitelist(list) {
        if (!pricesWhitelistGrid) return;
        pricesWhitelistGrid.innerHTML = '';
        if (list.length === 0) {
            pricesWhitelistGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1rem;">No whitelisted users.</div>';
            return;
        }
        list.forEach(item => {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'space-between';
            card.style.padding = '0.75rem 1rem';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.borderRadius = '8px';
            card.style.marginBottom = '0.5rem';
            card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${item.avatarUrl || 'assets/placeholder-roblox.png'}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); background: #111; object-fit: cover;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-1);">${item.displayName || item.username}</span>
                        <span style="font-size: 0.7rem; color: var(--text-3);">@${item.username} (ID: ${item.userId})</span>
                    </div>
                </div>
                <button class="preview-btn" style="background: var(--danger); font-size: 0.7rem; padding: 0.35rem 0.85rem; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
                    Remove
                </button>
            `;

            card.querySelector('button').addEventListener('click', async () => {
                try {
                    const res = await fetch('/api/prices/whitelist/remove', {
                        method: 'POST',
                        headers: getAdminHeaders(),
                        body: JSON.stringify({ userId: item.userId })
                    });
                    const data = await res.json();
                    if (data.success) renderPricesWhitelist(data.whitelist);
                } catch (e) { alert('Failed to remove user'); }
            });
            pricesWhitelistGrid.appendChild(card);
        });
    }

    if (btnAddPrices) {
        btnAddPrices.addEventListener('click', async () => {
            const val = pricesInput.value.trim();
            if (!val) return;
            try {
                const res = await fetch('/api/prices/whitelist/add', {
                    method: 'POST',
                    headers: getAdminHeaders(),
                    body: JSON.stringify({ userId: val })
                });
                const data = await res.json();
                if (data.success) {
                    pricesInput.value = '';
                    renderPricesWhitelist(data.whitelist);
                } else {
                    alert(data.message || 'Failed to add user');
                }
            } catch (e) { alert('Failed to add user'); }
        });
    }

    /* ── Prices Tab Manager (Suggestion Form) ────────────────────────────── */
    function initPricesTabManager() {
        const skinInput  = document.getElementById('suggest-skin-input');
        const catDisplay = document.getElementById('suggest-cat-display');
        const oldPriceEl = document.getElementById('suggest-old-price-display');
        const priceInput = document.getElementById('suggest-price-input');
        const btnSubmit  = document.getElementById('btn-submit-suggestion');
        const skinSugg   = document.getElementById('suggest-skin-suggestions');
        if (!skinInput || !btnSubmit) return;

        let selectedSuggestSkin = null;

        skinInput.addEventListener('input', () => {
            const q = skinInput.value.trim().toLowerCase();
            skinSugg.innerHTML = '';
            if (!q || !siteData) { skinSugg.style.display = 'none'; return; }

            // Search across ALL categories dynamically
            let matches = [];
            Object.keys(siteData.categories || {}).forEach(catName => {
                const cat = siteData.categories[catName];
                if (!cat) return;
                Object.keys(cat.items || {}).forEach(skinName => {
                    const lowerSkin = skinName.toLowerCase();
                    const lowerCat = catName.toLowerCase();
                    
                    // Exclude specific items
                    if (lowerCat === 'beams' && lowerSkin === 'lightning') return;
                    if (lowerCat === 'tags' && lowerSkin === 'verified') return;
                    if (lowerCat === 'exclusives' && lowerSkin === 'wings') return;
                    
                    if (lowerSkin.includes(q)) {
                        matches.push({ skinName, catName });
                    }
                });
            });


            if (matches.length === 0) { skinSugg.style.display = 'none'; return; }

            matches.slice(0, 10).forEach(item => {
                const d = document.createElement('div');
                d.className = 'trending-suggestion-item';
                d.textContent = `${item.skinName} (${item.catName})`;
                d.addEventListener('mousedown', e => {
                    e.preventDefault();
                    skinInput.value = item.skinName;
                    if (catDisplay) catDisplay.value = item.catName;

                    const currentItem = siteData?.categories[item.catName]?.items[item.skinName];
                    const oldPrice = currentItem ? currentItem.usd : 'N/A';
                    if (oldPriceEl) oldPriceEl.value = oldPrice ? `$${oldPrice}` : 'N/A';

                    selectedSuggestSkin = item;
                    skinSugg.style.display = 'none';
                    if (priceInput) priceInput.focus();
                });
                skinSugg.appendChild(d);
            });

            skinSugg.style.display = 'block';
        });

        skinInput.addEventListener('blur', () => {
            setTimeout(() => { skinSugg.style.display = 'none'; }, 200);
        });

        btnSubmit.addEventListener('click', async () => {
            if (!selectedSuggestSkin) {
                alert('Please select a valid skin from the suggestions list.');
                return;
            }

            const price = priceInput.value.trim();
            if (!price) {
                alert('Please enter a suggested price.');
                return;
            }

            // Basic price validation
            const parsedPrice = parseFloat(price.replace(/,/g, ''));
            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                alert('Please enter a valid price (number greater than 0).');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Submitting...';

            try {
                const sessionToken = localStorage.getItem('hc_session_token');
                const res = await fetch('/api/prices/suggest', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-token': sessionToken || ''
                    },
                    body: JSON.stringify({
                        category: selectedSuggestSkin.catName,
                        skinName: selectedSuggestSkin.skinName,
                        suggestedUsd: price
                    })
                });
                const data = await res.json();

                if (data.success) {
                    skinInput.value = '';
                    if (catDisplay) catDisplay.value = '';
                    priceInput.value = '';
                    if (oldPriceEl) oldPriceEl.value = '';
                    selectedSuggestSkin = null;
                    alert('Suggestion submitted successfully!');
                    refreshPricesView();
                } else {
                    alert(data.message || 'Failed to submit suggestion.');
                }
            } catch (e) {
                alert('Error submitting suggestion: ' + e.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Submit Suggestion';
            }
        });
    }

    async function fetchSuggestions(isAdmin) {
        const sessionToken = localStorage.getItem('hc_session_token');
        const adminToken = localStorage.getItem('admin_token');
        
        try {
            const res = await fetch('/api/prices/suggestions', {
                headers: {
                    'x-session-token': sessionToken || '',
                    'x-admin-token': adminToken || ''
                }
            });
            const data = await res.json();
            
            if (data.success) {
                renderSuggestions(data.suggestions, isAdmin);
            }
        } catch (e) {
            console.error('Failed to fetch suggestions:', e);
        }
    }

    function renderSuggestions(suggestions, isAdmin) {
        const approvalPanel = document.getElementById('prices-approval-panel');
        const approvalGrid = document.getElementById('approval-queue-grid');
        const mySuggestionsList = document.getElementById('my-suggestions-list');
        const suggestPanel = document.getElementById('prices-suggest-panel');
        const mySuggestionsPanel = document.getElementById('prices-my-suggestions-panel');
        
        if (isAdmin) {
            if (approvalPanel) approvalPanel.style.display = 'block';
            if (suggestPanel) suggestPanel.style.display = 'none';
            if (mySuggestionsPanel) mySuggestionsPanel.style.display = 'none';
            if (approvalGrid) {
                approvalGrid.innerHTML = '';
                
                // Show pending and approved suggestions
                const visibleSuggestions = suggestions.filter(s => s.status === 'pending' || s.status === 'approved');
                
                if (visibleSuggestions.length === 0) {
                    approvalGrid.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 2rem; grid-column: 1/-1;">No pending or approved suggestions.</div>';
                } else {
                    // Sort: pending first, then approved (reverse chronological)
                    visibleSuggestions.sort((a, b) => {
                        if (a.status === b.status) {
                            return new Date(b.submittedAt) - new Date(a.submittedAt);
                        }
                        return a.status === 'pending' ? -1 : 1;
                    });
                    
                    visibleSuggestions.forEach(sug => {
                        const card = document.createElement('div');
                        card.style.display = 'flex';
                        card.style.alignItems = 'center';
                        card.style.justifyContent = 'space-between';
                        card.style.gap = '1.2rem';
                        card.style.padding = '0.75rem 1rem';
                        card.style.background = 'rgba(255, 255, 255, 0.02)';
                        card.style.borderRadius = '8px';
                        card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                        card.style.marginBottom = '0.5rem';
                        card.style.flexWrap = 'wrap';
                        
                        const submittedDate = new Date(sug.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        const oldPrice = sug.oldUsd || 'N/A';
 
                        let actionHtml = '';
                        if (sug.status === 'pending') {
                            actionHtml = `
                                <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; min-width: 150px; flex: 1;">
                                    <button class="approve-btn" style="background: #22c55e; border: none; border-radius: 6px; color: white; padding: 0.45rem 0.85rem; font-weight: 600; font-size: 0.75rem; cursor: pointer; transition: opacity 0.2s;">Approve</button>
                                    <button class="deny-btn" style="background: #ef4444; border: none; border-radius: 6px; color: white; padding: 0.45rem 0.85rem; font-weight: 600; font-size: 0.75rem; cursor: pointer; transition: opacity 0.2s;">Deny</button>
                                </div>
                            `;
                        } else {
                            actionHtml = `
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; justify-content: flex-end; min-width: 170px; flex: 1;">
                                    <span style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; color: #22c55e; padding: 0.3rem 0.7rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem; text-align: center;">
                                        Approved
                                    </span>
                                    <button class="revert-btn" style="background: rgba(249, 115, 22, 0.12); border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 6px; color: #f97316; padding: 0.3rem 0.7rem; font-weight: 600; font-size: 0.72rem; cursor: pointer; transition: background 0.2s, border-color 0.2s; white-space: nowrap;" onmouseover="this.style.background='rgba(249,115,22,0.28)';this.style.borderColor='#f97316';" onmouseout="this.style.background='rgba(249,115,22,0.12)';this.style.borderColor='rgba(249,115,22,0.4)';">Revert Price</button>
                                </div>
                            `;
                        }
                        
                        card.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 180px; flex: 1.2;">
                                <img src="${sug.avatarUrl || 'assets/placeholder-roblox.png'}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid ${sug.status === 'approved' ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}; background: #111; object-fit: cover; flex-shrink: 0;">
                                <div style="display: flex; flex-direction: column; gap: 0.05rem;">
                                    <span style="font-size: 0.62rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em;">Suggested by</span>
                                    <span style="font-weight: 600; font-size: 0.82rem; color: var(--text-1);">${sug.displayName}</span>
                                    <span style="font-size: 0.65rem; color: var(--text-3);">@${sug.username} · ${submittedDate}</span>
                                </div>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; flex: 2; min-width: 220px; gap: 0.15rem;">
                                <span style="font-weight: 700; color: var(--text-1); font-size: 0.88rem;">${sug.skinName} <span style="font-weight: 400; font-size: 0.75rem; color: var(--accent);">(${sug.category})</span></span>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.1rem;">
                                    <span style="font-size: 0.72rem; color: var(--text-3);">Old:</span>
                                    <span style="font-size: 0.8rem; color: var(--text-2); font-weight: 600; text-decoration: line-through; opacity: 0.7;">$${oldPrice}</span>
                                    <span style="font-size: 0.8rem; color: var(--text-3);">→</span>
                                    <span style="font-size: 0.72rem; color: var(--text-3);">New:</span>
                                    <span style="font-size: 0.85rem; color: #4ade80; font-weight: 700;">$${sug.suggestedUsd}</span>
                                </div>
                            </div>
                            
                            ${actionHtml}
                        `;
                        
                        if (sug.status === 'pending') {
                            card.querySelector('.approve-btn').addEventListener('click', async () => {
                                try {
                                    const res = await fetch('/api/prices/approve', {
                                        method: 'POST',
                                        headers: getAdminHeaders(),
                                        body: JSON.stringify({ suggestionId: sug.id })
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                        try {
                                            const freshData = await fetch('/api/data', { credentials: 'same-origin' }).then(r => r.json());
                                            if (freshData && freshData.categories) {
                                                siteData = freshData;
                                            }
                                        } catch (_) {}
                                        refreshPricesView();
                                    } else {
                                        alert(d.message || 'Failed to approve suggestion.');
                                    }
                                } catch (e) {
                                    alert('Error approving suggestion: ' + e.message);
                                }
                            });
                            
                            card.querySelector('.deny-btn').addEventListener('click', async () => {
                                try {
                                    const res = await fetch('/api/prices/deny', {
                                        method: 'POST',
                                        headers: getAdminHeaders(),
                                        body: JSON.stringify({ suggestionId: sug.id })
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                        refreshPricesView();
                                    } else {
                                        alert(d.message || 'Failed to deny suggestion.');
                                    }
                                } catch (e) {
                                    alert('Error denying suggestion: ' + e.message);
                                }
                            });
                        } else if (sug.status === 'approved') {
                            card.querySelector('.revert-btn').addEventListener('click', async () => {
                                if (!confirm(`Revert "${sug.skinName}" price back from $${sug.suggestedUsd} → $${sug.oldUsd || 'N/A'}?`)) return;
                                try {
                                    const res = await fetch('/api/prices/revert', {
                                        method: 'POST',
                                        headers: getAdminHeaders(),
                                        body: JSON.stringify({ suggestionId: sug.id })
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                        try {
                                            const freshData = await fetch('/api/data', { credentials: 'same-origin' }).then(r => r.json());
                                            if (freshData && freshData.categories) {
                                                siteData = freshData;
                                            }
                                        } catch (_) {}
                                        alert('Price reverted successfully!');
                                        refreshPricesView();
                                    } else {
                                        alert(d.message || 'Failed to revert suggestion.');
                                    }
                                } catch (e) {
                                    alert('Error reverting suggestion: ' + e.message);
                                }
                            });
                        }
                        approvalGrid.appendChild(card);
                    });
                }
            }
        } else {
            if (approvalPanel) approvalPanel.style.display = 'none';
            if (suggestPanel) suggestPanel.style.display = 'block';
            if (mySuggestionsPanel) mySuggestionsPanel.style.display = 'block';
        }
        
        // ── Render User's Own Suggestions ──
        if (mySuggestionsList) {
            mySuggestionsList.innerHTML = '';
            if (suggestions.length === 0) {
                mySuggestionsList.innerHTML = '<div style="color:var(--text-3); font-size:0.8rem; text-align: center; padding: 1.5rem;">No suggestions submitted yet.</div>';
            } else {
                suggestions.forEach(sug => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.alignItems = 'center';
                    row.style.padding = '0.6rem 0.8rem';
                    row.style.background = 'rgba(255,255,255,0.01)';
                    row.style.border = '1px solid rgba(255,255,255,0.03)';
                    row.style.borderRadius = '6px';
                    
                    let statusBadge = '';
                    if (sug.status === 'pending') {
                        statusBadge = '<span style="font-size:0.7rem; padding: 0.25rem 0.5rem; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); color: #eab308; border-radius: 4px; font-weight: 600;">Pending</span>';
                    } else if (sug.status === 'approved') {
                        statusBadge = '<span style="font-size:0.7rem; padding: 0.25rem 0.5rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #22c55e; border-radius: 4px; font-weight: 600;">Approved</span>';
                    } else {
                        statusBadge = '<span style="font-size:0.7rem; padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 4px; font-weight: 600;">Denied</span>';
                    }
                    
                    row.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.2rem;">
                            <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-1);">${sug.skinName} (${sug.category})</span>
                            <span style="font-size: 0.75rem; color: #4ade80; font-weight: 600;">Suggested USD: $${sug.suggestedUsd}</span>
                        </div>
                        <div>
                            ${statusBadge}
                        </div>
                    `;
                    mySuggestionsList.appendChild(row);
                });
            }
        }
    }

    /* ─────────────────────────────────────────────────────────
       DONATION MODAL LOGIC
    ───────────────────────────────────────────────────────── */

    // ── Data ──
    const CRYPTO_ADDRESSES = [
        {
            coin: 'BTC',
            name: 'Bitcoin',
            address: 'bc1q5jfvfxe4wr0wdm5waaezel3sl9de6c8c43zm5k',
            color: '#f7931a',
            bg: 'rgba(247,147,26,0.15)',
            symbol: '₿'
        },
        {
            coin: 'ETH',
            name: 'Ethereum',
            address: '0x6567C18A72Ce80ADa45081c06F8fee025fe71b0b',
            color: '#627eea',
            bg: 'rgba(98,126,234,0.15)',
            symbol: 'Ξ'
        },
        {
            coin: 'USDT',
            name: 'Tether (USDT)',
            address: '0x6567C18A72Ce80ADa45081c06F8fee025fe71b0b',
            color: '#26a17b',
            bg: 'rgba(38,161,123,0.15)',
            symbol: '₮'
        },
        {
            coin: 'LTC',
            name: 'Litecoin',
            address: 'LXKjfw5QEQeQZcx284XpF12AHuRPkTSk5t',
            color: '#bfbbbb',
            bg: 'rgba(191,187,187,0.12)',
            symbol: 'Ł'
        },
        {
            coin: 'SOL',
            name: 'Solana',
            address: 'HXitr7F8uPcQghrLfqu6uWz7ejtrsCbTnRZho1Kusfmf',
            color: '#9945ff',
            bg: 'rgba(153,69,255,0.15)',
            symbol: '◎'
        }
    ];

    // Robux tiers: { amount (display), robux (raw), link (gamepass URL) }
    const ROBUX_TIERS = [
        { amount: '100 Robux',   robux: 100,  link: 'https://www.roblox.com/game-pass/942817608/100' },
        { amount: '200 Robux',   robux: 200,  link: 'https://www.roblox.com/game-pass/944233035/200' },
        { amount: '500 Robux',   robux: 500,  link: 'https://www.roblox.com/game-pass/942573753/500' },
        { amount: '1,000 Robux',  robux: 1000, link: 'https://www.roblox.com/game-pass/945162474/1000' },
        { amount: '1,500 Robux',  robux: 1500, link: 'https://www.roblox.com/game-pass/942527918/1500' },
        { amount: '2,500 Robux',  robux: 2500, link: 'https://www.roblox.com/game-pass/942997742/2500' }
    ];

    // ── Build Crypto list ──
    function buildCryptoList() {
        const list = document.getElementById('crypto-address-list');
        if (!list) return;
        list.innerHTML = '';
        CRYPTO_ADDRESSES.forEach(({ coin, name, address, color, bg, symbol }) => {
            const row = document.createElement('div');
            row.className = 'crypto-row';
            row.innerHTML = `
                <div class="crypto-coin-icon" style="background:${bg}; color:${color};">${symbol}</div>
                <div class="crypto-coin-info">
                    <div class="crypto-coin-name">${name} (${coin})</div>
                    <div class="crypto-coin-address">${address}</div>
                </div>
                <button class="crypto-copy-btn" data-address="${address}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                </button>
            `;
            const copyBtn = row.querySelector('.crypto-copy-btn');
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(address);
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                    }, 2000);
                } catch {
                    copyBtn.textContent = 'Failed';
                }
            });
            list.appendChild(row);
        });
    }

    // ── Build Robux tiers ──
    function buildRobuxTiers() {
        const list = document.getElementById('robux-tiers-list');
        if (!list) return;
        list.innerHTML = '';
        ROBUX_TIERS.forEach(({ amount, link }) => {
            const row = document.createElement('a');
            row.className = 'robux-tier-row';
            row.href = link;
            row.target = '_blank';
            row.rel = 'noopener noreferrer';
            row.innerHTML = `
                <div class="robux-tier-icon">⏣</div>
                <div class="robux-tier-info">
                    <div class="robux-tier-amount">${amount}</div>
                    <div class="robux-tier-label">Click to open Roblox gamepass</div>
                </div>
                <span class="robux-tier-arrow">→</span>
            `;
            list.appendChild(row);
        });
    }

    // ── Tab switching ──
    function initDonationTabs() {
        const tabs = document.querySelectorAll('.donation-tab');
        const panels = document.querySelectorAll('.donation-panel');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById(`dpanel-${target}`);
                if (panel) panel.classList.add('active');
            });
        });
    }

    // ── Open / Close ──
    function openDonationModal() {
        const overlay = document.getElementById('donation-overlay');
        if (!overlay) return;
        // Reset to PayPal tab
        document.querySelectorAll('.donation-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.donation-panel').forEach(p => p.classList.remove('active'));
        const defaultTab = document.getElementById('dtab-paypal');
        const defaultPanel = document.getElementById('dpanel-paypal');
        if (defaultTab) defaultTab.classList.add('active');
        if (defaultPanel) defaultPanel.classList.add('active');

        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('active');
    }

    function closeDonationModal() {
        const overlay = document.getElementById('donation-overlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }

    // ── Wire up close interactions ──
    const donationOverlay = document.getElementById('donation-overlay');
    const donationCloseBtn = document.getElementById('donation-modal-close');

    if (donationCloseBtn) donationCloseBtn.addEventListener('click', closeDonationModal);
    if (donationOverlay) {
        donationOverlay.addEventListener('click', (e) => {
            if (e.target === donationOverlay) closeDonationModal();
        });
    }

    // ── Fetch dynamic trading server link ──
    async function fetchTradingServerLink() {
        const linkEl = document.getElementById('navlink-trading-server');
        if (!linkEl) return;
        try {
            const response = await fetch('/api/trading-server');
            const data = await response.json();
            if (data.success && data.link) {
                linkEl.href = data.link;
            }
        } catch (err) {
            console.error('Error fetching trading server link:', err);
        }
    }

    // ── Build lists once ──
    buildCryptoList();
    buildRobuxTiers();
    initDonationTabs();
    fetchTradingServerLink();
    loadPublicWhitelist();

});

