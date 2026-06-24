import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';

export async function generateStaticParams() {
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
  ];
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const posts: any = {
    '1': {
      title: 'The Ultimate Guide to Shopping Online Safely',
      image: 'https://picsum.photos/seed/store-blog-post1/1200/600',
      category: 'Shopping Tips',
      date: 'December 15, 2024',
      readTime: '8 min read',
      author: 'Staff',
      content: `
        <p>Online shopping offers convenience, variety, and competitive prices. If you are new to ecommerce, this guide will help you shop safely and confidently.</p>

        <h2>Why shop online?</h2>
        <p>You can browse a wide catalogue from home, compare prices, read reviews, and arrange delivery. Many stores also run online-only promotions and let you shop outside traditional opening hours.</p>

        <h2>Choosing a reliable store</h2>
        <p>Look for clear trust signals before you buy:</p>
        <ul>
          <li><strong>Secure website:</strong> The URL should use HTTPS and show a valid certificate</li>
          <li><strong>Contact details:</strong> Email, phone, and support channels should be easy to find</li>
          <li><strong>Reviews:</strong> Feedback from verified buyers where available</li>
          <li><strong>Returns:</strong> Clear terms for refunds and exchanges</li>
          <li><strong>Product information:</strong> Accurate descriptions, specifications, and photos</li>
        </ul>

        <h2>Payment options</h2>
        <p>Depending on the store, you may see card payments, bank transfer, digital wallets, or other methods offered by the site’s payment partner. Always confirm you are on the real checkout page before entering details.</p>

        <p>Use a private network where possible, and avoid saving card details on shared devices.</p>

        <h2>Delivery</h2>
        <p>Timeframes and fees depend on your address and the carrier. Check estimated delivery, shipping cost, tracking, and what happens if you are not available to receive the parcel.</p>

        <h2>Safe shopping habits</h2>
        <ol>
          <li><strong>Research the seller</strong>: check ratings and policies</li>
          <li><strong>Read listings carefully</strong>: note size, colour, and compatibility</li>
          <li><strong>Keep records</strong>: order confirmations and receipts</li>
          <li><strong>Know the return window</strong> before you need it</li>
          <li><strong>Use strong, unique passwords</strong> for store accounts</li>
          <li><strong>Monitor statements</strong> for unexpected charges</li>
          <li><strong>Be sceptical</strong> of unrealistic discounts and pressure tactics</li>
        </ol>

        <h2>If something goes wrong</h2>
        <p>Contact the store with your order reference and photos if relevant. If you used a card or wallet, your provider may help with disputes for eligible cases.</p>

        <h2>Conclusion</h2>
        <p>With a few good habits, online shopping can be straightforward and secure. Start with smaller orders while you build trust in a store, then enjoy the convenience of shopping from anywhere.</p>
      `
    },
    '2': {
      title: '10 Must-Have Products for Your Home This Season',
      image: 'https://picsum.photos/seed/store-blog-post2/1200/600',
      category: 'Home & Living',
      date: 'December 12, 2024',
      readTime: '6 min read',
      author: 'Staff',
      content: `
        <p>Transform your living space with these carefully selected must-have products. Whether you're refreshing your décor or starting from scratch, these items will elevate your home's comfort and style.</p>

        <h2>1. Smart LED Lighting</h2>
        <p>Modern LED bulbs with adjustable brightness and colour temperature can dramatically change your home's ambience. Control them from your phone, set schedules, and reduce energy costs.</p>

        <h2>2. Premium Bedding Set</h2>
        <p>Invest in quality sheets, duvet covers, and pillows. Good sleep is essential, and premium bedding makes a noticeable difference. Look for breathable fabrics that suit your climate.</p>

        <h2>3. Air Purifier</h2>
        <p>With increasing air quality concerns, an air purifier removes dust, pollen, and pollutants, creating a healthier indoor environment for your family.</p>

        <h2>4. Organisational Storage Solutions</h2>
        <p>Declutter your space with stylish storage boxes, baskets, and shelving units. A well-organised home feels more spacious and serene.</p>

        <h2>5. Indoor Plants</h2>
        <p>Bring nature indoors with low-maintenance plants like snake plants or pothos. They purify air, add visual interest, and create a calming atmosphere.</p>

        <h2>6. Quality Cookware Set</h2>
        <p>Upgrade your kitchen with durable pots and pans. Quality cookware distributes heat evenly, lasts longer, and makes cooking more enjoyable.</p>

        <h2>7. Comfortable Throw Pillows</h2>
        <p>Instantly refresh your living room or bedroom with decorative throw pillows. Mix textures and colours to create visual interest.</p>

        <h2>8. Smart Power Strip</h2>
        <p>Protect your electronics and reduce energy waste with a smart power strip that cuts power to devices in standby mode.</p>

        <h2>9. Bath Towel Set</h2>
        <p>Luxury doesn't have to be expensive. A set of soft, absorbent towels in coordinating colours makes your bathroom feel like a spa.</p>

        <h2>10. Decorative Mirror</h2>
        <p>Mirrors make spaces feel larger and brighter by reflecting light. Choose a statement piece that complements your décor style.</p>

        <h2>Shopping Smart</h2>
        <p>When purchasing home products, consider quality over quantity. It's better to invest in a few well-made items than many cheap ones that won't last. Read reviews, compare prices, and take advantage of seasonal sales.</p>

        <p>Start with the essentials and gradually build your collection. Your home should reflect your personality and meet your practical needs.</p>
      `
    },
    '3': {
      title: 'How to Choose Quality Products: A Buyer\'s Guide',
      image: 'https://picsum.photos/seed/store-blog-post3/1200/600',
      category: 'Buying Guide',
      date: 'December 10, 2024',
      readTime: '7 min read',
      author: 'Staff',
      content: `
        <p>In a market flooded with options, choosing quality products can be challenging. This guide will help you identify genuine quality and make purchasing decisions you won't regret.</p>

        <h2>Understanding Quality Indicators</h2>
        <p>Quality isn't just about price. A well-made product offers durability, functionality, and value for money. Here's what to look for:</p>

        <h3>Material Quality</h3>
        <p>Examine the materials used. Natural fibres, solid wood, stainless steel, and durable plastics indicate better quality. Avoid products that feel flimsy or have a chemical smell.</p>

        <h3>Construction and Craftsmanship</h3>
        <p>Check seams, joints, and finishes. Quality products have neat stitching, smooth edges, and secure fastenings. Poor construction is evident in loose threads, uneven surfaces, and wobbly parts.</p>

        <h3>Brand Reputation</h3>
        <p>Established brands invest in quality control and customer satisfaction. Research brands before purchasing. Read reviews and check how they handle complaints.</p>

        <h2>Reading Product Descriptions</h2>
        <p>Detailed product descriptions are a good sign. Quality sellers provide:</p>
        <ul>
          <li>Precise dimensions and specifications</li>
          <li>Material composition</li>
          <li>Care instructions</li>
          <li>Warranty information</li>
          <li>Multiple clear photos from different angles</li>
        </ul>

        <h2>The Power of Reviews</h2>
        <p>Customer reviews are invaluable. Look for:</p>
        <ul>
          <li>Verified purchase badges</li>
          <li>Detailed feedback with photos</li>
          <li>Recent reviews (product quality can change)</li>
          <li>How sellers respond to negative reviews</li>
          <li>Overall rating trends</li>
        </ul>

        <p>Be sceptical of products with only perfect 5-star reviews or very few reviews relative to sales.</p>

        <h2>Price vs. Value</h2>
        <p>Expensive doesn't always mean quality, and cheap isn't always poor. Consider:</p>
        <ul>
          <li><strong>Cost per use:</strong> A higher-quality item used for years can beat repeatedly replacing a cheaper alternative</li>
          <li><strong>Warranty and guarantees:</strong> Quality manufacturers stand behind their products</li>
          <li><strong>Maintenance costs:</strong> Some cheap items require expensive upkeep</li>
          <li><strong>Resale value:</strong> Quality items retain value better</li>
        </ul>

        <h2>Red Flags to Avoid</h2>
        <p>Watch out for these warning signs:</p>
        <ul>
          <li>Vague or missing product information</li>
          <li>No return policy or unclear terms</li>
          <li>Prices significantly below market average</li>
          <li>Poor website quality and numerous spelling errors</li>
          <li>Lack of contact information</li>
          <li>Pressure tactics urging immediate purchase</li>
          <li>No physical address or company details</li>
        </ul>

        <h2>Category-Specific Tips</h2>

        <h3>Electronics</h3>
        <ul>
          <li>Check for official warranty from manufacturer</li>
          <li>Verify authenticity through serial numbers</li>
          <li>Compare specifications carefully</li>
          <li>Research common issues with the model</li>
        </ul>

        <h3>Clothing and Textiles</h3>
        <ul>
          <li>Natural fibres often last longer</li>
          <li>Check fabric weight (heavier usually means quality)</li>
          <li>Examine stitching and seams</li>
          <li>Verify colour fastness information</li>
        </ul>

        <h3>Furniture</h3>
        <ul>
          <li>Solid wood beats particle board</li>
          <li>Test weight capacity</li>
          <li>Check joinery methods</li>
          <li>Assess cushion density and spring quality</li>
        </ul>

        <h2>Making the Final Decision</h2>
        <p>Before clicking "buy," ask yourself:</p>
        <ol>
          <li>Do I need this product?</li>
          <li>Have I researched alternatives?</li>
          <li>Is this the right time to buy? (sales, seasons)</li>
          <li>Can I afford it without financial strain?</li>
          <li>Does it meet my quality standards?</li>
          <li>What's the return policy if I'm unsatisfied?</li>
        </ol>

        <h2>After Purchase</h2>
        <p>Protect your investment:</p>
        <ul>
          <li>Inspect items immediately upon delivery</li>
          <li>Keep packaging until you're certain you'll keep it</li>
          <li>Register warranties</li>
          <li>Follow care instructions</li>
          <li>Leave honest reviews to help other shoppers</li>
        </ul>

        <h2>Conclusion</h2>
        <p>Choosing quality products requires research, patience, and critical thinking. Don't rush important purchases. Take time to compare options, read reviews, and verify seller credibility. Quality products cost more upfront but offer better value long-term through durability, performance, and satisfaction.</p>

        <p>Remember: the bitterness of poor quality lingers long after the sweetness of a low price is forgotten.</p>
      `
    }
  };

  const post = posts[id] || posts['1'];

  const relatedPosts = [
    {
      id: id === '1' ? '2' : '1',
      title: id === '1' ? '10 Must-Have Products for Your Home This Season' : 'The Ultimate Guide to Shopping Online Safely',
      image: id === '1' ?
        'https://picsum.photos/seed/store-blog-related1/600/400' :
        'https://picsum.photos/seed/store-blog-related2/600/400',
      category: id === '1' ? 'Home & Living' : 'Shopping Tips'
    },
    {
      id: id === '3' ? '1' : '3',
      title: id === '3' ? 'The Ultimate Guide to Shopping Online Safely' : 'How to Choose Quality Products: A Buyer\'s Guide',
      image: id === '3' ?
        'https://picsum.photos/seed/store-blog-related3/600/400' :
        'https://picsum.photos/seed/store-blog-related4/600/400',
      category: id === '3' ? 'Shopping Tips' : 'Buying Guide'
    }
  ];

  return (
    <div className="store-page">
      <div className="relative h-96 bg-gray-900">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block bg-brand-accent text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              {post.category}
            </span>
            <h1 className="text-5xl font-bold text-white mb-6">{post.title}</h1>
            <div className="flex items-center justify-center gap-6 text-white/80">
              <span className="flex items-center gap-2">
                <i className="ri-user-line"></i>
                {post.author}
              </span>
              <span className="flex items-center gap-2">
                <i className="ri-calendar-line"></i>
                {post.date}
              </span>
              <span className="flex items-center gap-2">
                <i className="ri-time-line"></i>
                {post.readTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-lg max-w-none">
          <div
            className="text-gray-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            style={{
              fontSize: '1.125rem',
              lineHeight: '1.8'
            }}
          />
        </article>

        <div className="mt-12 pt-12 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Written by</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center">
                  <i className="ri-user-line text-brand-primary text-xl"></i>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{post.author}</p>
                  <p className="text-sm text-gray-500">Content Writer</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-3">Share this article</p>
              <div className="flex gap-3">
                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-brand-light transition-colors cursor-pointer">
                  <i className="ri-facebook-fill text-gray-600"></i>
                </button>
                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-brand-light transition-colors cursor-pointer">
                  <i className="ri-twitter-fill text-gray-600"></i>
                </button>
                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-brand-light transition-colors cursor-pointer">
                  <i className="ri-linkedin-fill text-gray-600"></i>
                </button>
                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-brand-light transition-colors cursor-pointer">
                  <i className="ri-whatsapp-line text-gray-600"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Related Articles</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.id}
                href={`/blog/${relatedPost.id}`}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="relative h-48">
                  <img
                    src={relatedPost.image}
                    alt={relatedPost.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-4 left-4 bg-brand-primary text-white px-3 py-1 rounded-full text-xs font-medium">
                    {relatedPost.category}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {relatedPost.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-16 bg-gradient-to-br from-brand-primary to-[#050f1f] rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Enjoyed This Article?</h2>
          <p className="text-white/80 mb-8 text-lg">
            Subscribe to our newsletter for more shopping tips and exclusive offers
          </p>
          <form className="max-w-md mx-auto flex gap-3">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 px-6 py-4 rounded-full text-gray-900 focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="bg-white text-brand-primary px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-brand-primary font-medium hover:gap-3 transition-all"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
