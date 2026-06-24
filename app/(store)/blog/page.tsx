import Link from 'next/link';

export default function BlogPage() {
  const featuredPost = {
    id: '1',
    title: 'How to import without getting scammed',
    excerpt: 'Simple steps to buy from China safely. Know who to trust before you pay.',
    image: 'https://picsum.photos/seed/store-blog-list1/1200/600',
    category: 'Shopping Tips',
    date: 'December 15, 2024',
    readTime: '8 min read',
    author: 'Staff'
  };

  const posts = [
    {
      id: '2',
      title: '10 Must-Have Products for Your Home This Season',
      excerpt: 'Discover the trending products that will elevate your living space and make your home more comfortable and stylish.',
      image: 'https://picsum.photos/seed/store-blog-list2/800/500',
      category: 'Home & Living',
      date: 'December 12, 2024',
      readTime: '6 min read',
      author: 'Staff'
    },
    {
      id: '3',
      title: 'How to Choose Quality Products: A Buyer\'s Guide',
      excerpt: 'Learn the key indicators of quality products and how to make informed purchasing decisions that offer the best value for your money.',
      image: 'https://picsum.photos/seed/store-blog-list3/800/500',
      category: 'Buying Guide',
      date: 'December 10, 2024',
      readTime: '7 min read',
      author: 'Staff'
    },
    {
      id: '1',
      title: 'The Ultimate Guide to Shopping Online Safely',
      excerpt: 'Practical tips for secure checkout and reliable delivery.',
      image: 'https://picsum.photos/seed/store-blog-list1b/800/500',
      category: 'Shopping Tips',
      date: 'December 15, 2024',
      readTime: '8 min read',
      author: 'Staff'
    }
  ];

  const categories = [
    { name: 'All Posts', count: 12, icon: 'ri-article-line' },
    { name: 'Shopping Tips', count: 5, icon: 'ri-shopping-bag-line' },
    { name: 'Product Reviews', count: 4, icon: 'ri-star-line' },
    { name: 'Home & Living', count: 3, icon: 'ri-home-line' },
    { name: 'Buying Guide', count: 6, icon: 'ri-guide-line' },
    { name: 'News', count: 2, icon: 'ri-newspaper-line' }
  ];

  return (
    <div className="store-page">
      <div className="store-page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Tips and guides</h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Simple advice to help your next import go smoothly.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href={`/blog/${featuredPost.id}`} className="block mb-16 hover:opacity-90 transition-opacity cursor-pointer">
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative h-96 md:h-auto">
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-6 left-6">
                  <span className="bg-brand-primary text-white px-4 py-2 rounded-full text-sm font-medium">
                    Featured
                  </span>
                </div>
              </div>
              <div className="p-12 flex flex-col justify-center">
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                    {featuredPost.category}
                  </span>
                  <span>{featuredPost.date}</span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    {featuredPost.readTime}
                  </span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center">
                    <i className="ri-user-line text-brand-primary"></i>
                  </div>
                  <span className="text-gray-900 font-medium">{featuredPost.author}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Latest Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="relative h-64">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium text-xs">
                        {post.category}
                      </span>
                      <span className="text-xs">{post.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <i className="ri-user-line text-gray-600 text-sm"></i>
                        </div>
                        <span className="text-sm text-gray-900 font-medium">{post.author}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <nav className="flex items-center gap-2">
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <i className="ri-arrow-left-s-line text-gray-600"></i>
                </button>
                <button className="w-10 h-10 flex items-center justify-center bg-brand-primary text-white rounded-lg cursor-pointer">
                  1
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  2
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  3
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <i className="ri-arrow-right-s-line text-gray-600"></i>
                </button>
              </nav>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-2xl p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Categories</h3>
              <div className="space-y-2">
                {categories.map((category, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <i className={`${category.icon} text-brand-primary`}></i>
                      <span className="text-gray-900 font-medium">{category.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{category.count}</span>
                  </button>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Newsletter</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  Get the latest articles and shopping tips delivered to your inbox weekly.
                </p>
                <form className="space-y-3">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-[#0d2747] transition-colors whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Popular Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {['Shopping', 'Quality', 'Reviews', 'Delivery', 'Tips', 'Home', 'Style', 'Guides'].map((tag, index) => (
                    <button
                      key={index}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-brand-accent hover:text-brand-primary transition-colors cursor-pointer whitespace-nowrap"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand-primary to-[#050f1f] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Shopping?</h2>
          <p className="text-xl text-white/80 mb-8 leading-relaxed">
            Browse our latest articles
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-white text-brand-primary px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            Explore Products
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
